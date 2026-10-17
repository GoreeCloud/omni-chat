#!/usr/bin/env python3
"""Stage a pinned upstream Admin Panel checkout for an isolated image trial.

Never invoke this on the checked-in Omni Chat source tree or a running service.
No source image is published or deployed by this script.
"""
import json
from pathlib import Path
import subprocess
import sys

UPSTREAM_SHA = "82fb4b61409d5c2e6eceb3d116b89bc957c1620e"

VERSIONS = {
    "@tanstack/router-core": "1.171.34",
    "@tanstack/router-plugin": "1.168.42",
    "@tanstack/router-generator": "1.167.40",
    "@tanstack/history": "1.162.4",
    "@tanstack/react-store": "0.11.2",
    "@tanstack/start-fn-stubs": "1.162.0",
    "@tanstack/start-storage-context": "1.167.36",
    "seroval": "1.6.7",
    "@babel/core": "7.29.7",
    "zod": "4.5.4",
}

def stage(source: Path) -> None:
    source = source.resolve(strict=True)
    actual = subprocess.check_output(
        ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual != UPSTREAM_SHA:
        raise ValueError(f"Refusing unverified Admin Panel source: {actual}")
    changed = subprocess.check_output(
        ["git", "-C", str(source), "status", "--porcelain"], text=True
    ).strip()
    if changed:
        raise ValueError("Refusing to modify a dirty upstream checkout")

    package = source / "package.json"
    document = json.loads(package.read_text())
    if document["dependencies"]["@tanstack/react-start"] != "1.167.30":
        raise ValueError("Unexpected upstream React Start graph")
    if document["overrides"]["@tanstack/react-start"] != "1.167.30":
        raise ValueError("Unexpected upstream React Start override")

    dependencies = {
        "@tanstack/react-start": "1.168.60",
        "@tanstack/react-router": "1.170.41",
    }
    overrides = {
        "@tanstack/react-start": "1.168.60",
        "@tanstack/start-server-core": "1.169.39",
        "@tanstack/react-router": "1.170.41",
        "@tanstack/router-utils": "1.162.3",
        "@tanstack/start-client-core": "1.170.34",
        "@tanstack/start-plugin-core": "1.171.49",
        "@tanstack/react-start-client": "1.168.39",
        "@tanstack/react-start-server": "1.167.46",
        "seroval": "1.6.3",
        "shell-quote": "1.11.0",
        "tmp": "0.2.7",
    }
    document["dependencies"].update(dependencies)
    document["overrides"].update(overrides)
    for name, version in VERSIONS.items():
        for section in ("dependencies", "devDependencies"):
            if name in document.get(section, {}):
                document[section][name] = version
        document["overrides"][name] = version

    dockerfile = source / "Dockerfile"
    original = dockerfile.read_text()
    base = "FROM oven/bun:1.3.11-alpine AS base\n"
    install = "RUN bun install --frozen-lockfile \\\n    && bun install --frozen-lockfile --production\n"
    if original.count(base) != 1 or original.count(install) != 1:
        raise ValueError("Unexpected upstream Dockerfile, refusing mutation")
    upgraded = original.replace(
        base, "FROM oven/bun:1.4.0-alpine AS base\nRUN apk upgrade --no-cache\n"
    ).replace(
        install, "RUN bun install --frozen-lockfile \\\n    && bun prune --production\n"
    )
    # Zod 4 exposes _def.type ("optional", "array", etc.) instead of
    # the Zod 3 _def.typeName metadata used by the pinned scope helpers.
    # This trial stages the smallest shared compatibility shim; tests must pass.
    config_file = source / "src/server/config.ts"
    original_config = config_file.read_text()
    patched_config = original_config
    for before, after in (
        ("const INDEXED_ARRAY_RE = /^(.+)\\.(\\d+)$/;", "function schemaTypeName(schema: t.ZodSchemaLike): string | undefined {\n  const kind = schema?._def?.typeName ?? schema?._def?.type;\n  if (typeof kind !== 'string') return undefined;\n  return kind.startsWith('Zod') ? kind : `Zod${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;\n}\n\nconst INDEXED_ARRAY_RE = /^(.+)\\.(\\d+)$/;"),
        ("while (current?._def?.typeName && WRAPPER_TYPES.has(current._def.typeName)) {", "while (schemaTypeName(current) && WRAPPER_TYPES.has(schemaTypeName(current)!)) {"),
        ("if (current._def.typeName === 'ZodLazy') {", "if (schemaTypeName(current) === 'ZodLazy') {"),
        ("} else if (current._def.typeName === 'ZodPipeline') {", "} else if (schemaTypeName(current) === 'ZodPipeline') {"),
        ("} else if (current._def.typeName === 'ZodEffects') {", "} else if (schemaTypeName(current) === 'ZodEffects') {"),
        ("const typeName = unwrapped._def.typeName;", "const typeName = schemaTypeName(unwrapped);"),
        ("if (unwrapped?._def?.typeName !== 'ZodArray') return null;", "if (schemaTypeName(unwrapped) !== 'ZodArray') return null;"),
    ):
        if patched_config.count(before) != 1:
            raise ValueError(f"Unexpected upstream schema helper: {before}")
        patched_config = patched_config.replace(before, after)
    schema_paths_before = "    cachedSchemaPathSet = new Set(paths);"
    schema_paths_after = "    cachedSchemaPathSet = new Set(paths);\n    // The indexed secret-preview filter needs complete schema leaf paths.\n    // Zod 4 represents wrapped objects and array elements differently, so\n    // walk the canonical schema directly without trusting legacy UI extraction.\n    const visitSchema = (node: t.ZodSchemaLike, path: string, depth: number): void => {\n      if (!node || depth > 16) return;\n      const item = unwrapSchema(node);\n      if (item?.shape && typeof item.shape === 'object') {\n        for (const [key, child] of Object.entries(item.shape)) {\n          const childPath = path ? `${path}.${key}` : key;\n          cachedSchemaPathSet!.add(childPath);\n          visitSchema(child as t.ZodSchemaLike, childPath, depth + 1);\n        }\n      } else if (schemaTypeName(item) === 'ZodArray') {\n        const array = item as unknown as {\n          element?: t.ZodSchemaLike;\n          _def?: { element?: t.ZodSchemaLike; type?: t.ZodSchemaLike | string };\n        };\n        const element = array.element ?? array._def?.element ??\n          (typeof array._def?.type === 'object' ? array._def.type : undefined);\n        if (element) visitSchema(element, path, depth + 1);\n      }\n    };\n    visitSchema(configSchema as t.ZodSchemaLike, '', 0);"
    if patched_config.count(schema_paths_before) != 1:
        raise ValueError("Unexpected upstream schema path extraction")
    patched_config = patched_config.replace(schema_paths_before, schema_paths_after)
    package.write_text(json.dumps(document, indent=2) + "\n")
    dockerfile.write_text(upgraded)
    config_file.write_text(patched_config)
    print(f"Prepared isolated Admin source at {UPSTREAM_SHA}; no image published")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_omni_admin_candidate.py <disposable-upstream-checkout>")
    stage(Path(sys.argv[1]))
