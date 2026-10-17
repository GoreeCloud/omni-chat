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
    # Complete the Zod 3/4 schema traversal and type inference used by all
    # Admin configuration controls, not only indexed secret-preview paths.
    for before, after, expected in (
        ("return kind.startsWith('Zod') ? kind : `Zod${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;", "if (kind === 'pipe') return 'ZodPipeline';\n  if (kind === 'transform') return 'ZodEffects';\n  return kind.startsWith('Zod') ? kind : `Zod${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;", 1),
        ("const INDEXED_ARRAY_RE = /^(.+)\\.(\\d+)$/;", "function schemaArrayElement(schema: t.ZodSchemaLike): t.ZodSchemaLike | undefined {\n  const item = schema as unknown as {\n    element?: t.ZodSchemaLike;\n    _def?: { element?: t.ZodSchemaLike; type?: t.ZodSchemaLike | string };\n  };\n  return item.element ?? item._def?.element ??\n    (typeof item._def?.type === 'object' ? item._def.type : undefined);\n}\n\nconst INDEXED_ARRAY_RE = /^(.+)\\.(\\d+)$/;", 1),
        ("if (schema?._def?.typeName !== 'ZodIntersection') return null;", "if (schemaTypeName(schema) !== 'ZodIntersection') return null;", 1),
        ("if (!schema?._def || schema._def.typeName !== 'ZodUnion') return false;", "if (schemaTypeName(schema) !== 'ZodUnion') return false;", 3),
        ("unwrapped?._def?.typeName === 'ZodBoolean'", "schemaTypeName(unwrapped) === 'ZodBoolean'", 1),
        ("const tn = schema._def.typeName;", "const tn = schemaTypeName(schema);", 1),
        ("const optTn = opt?._def?.typeName;", "const optTn = schemaTypeName(opt);", 1),
        ("while (innerSchema?._def?.typeName && WRAPPER_TYPES.has(innerSchema._def.typeName)) {", "while (schemaTypeName(innerSchema) && WRAPPER_TYPES.has(schemaTypeName(innerSchema)!)) {", 1),
        ("if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {", "if (schemaTypeName(innerSchema) === 'ZodOptional' || schemaTypeName(innerSchema) === 'ZodDefault') {", 1),
        ("if (def.typeName === 'ZodNullable') {", "if (schemaTypeName(innerSchema) === 'ZodNullable') {", 1),
        ("if (def.typeName === 'ZodLazy') {", "if (schemaTypeName(innerSchema) === 'ZodLazy') {", 1),
        ("} else if (def.typeName === 'ZodPipeline') {", "} else if (schemaTypeName(innerSchema) === 'ZodPipeline') {", 1),
        ("} else if (def.typeName === 'ZodEffects') {", "} else if (schemaTypeName(innerSchema) === 'ZodEffects') {", 1),
        ("return schema._def?.typeName === 'ZodArray';", "return schemaTypeName(schema) === 'ZodArray';", 1),
        ("const typeName = innerSchema._def.typeName;", "const typeName = schemaTypeName(innerSchema);", 1),
        ("const elementType = innerSchema._def.type;", "const elementType = schemaArrayElement(innerSchema);", 1),
        ("if (isArray && innerSchema?._def?.type) {", "if (isArray && schemaArrayElement(innerSchema)) {", 1),
        ("let elementSchema: t.ZodSchemaLike = innerSchema._def.type;", "let elementSchema: t.ZodSchemaLike = schemaArrayElement(innerSchema)!;", 1),
        ("const elementType = unwrapped._def.type;", "const elementType = schemaArrayElement(unwrapped);", 1),
        ("const values = innerSchema._def?.values ?? [];", "const values = innerSchema._def?.values ?? (innerSchema._def as unknown as { entries?: Record<string, string> }).entries ?? [];", 1),
        ("const raw = innerSchema._def?.values ?? {};", "const raw = innerSchema._def?.values ?? (innerSchema._def as unknown as { entries?: Record<string, string> }).entries ?? {};", 1),
        ("if (current._def.typeName === 'ZodDefault') {", "if (schemaTypeName(current) === 'ZodDefault') {", 1),
        ("current._def.typeName === 'ZodEffects' ? current._def.schema : current._def.innerType;", "schemaTypeName(current) === 'ZodEffects' ? current._def.schema : current._def.innerType;", 1),
    ):
        if patched_config.count(before) != expected:
            raise ValueError(f"Unexpected upstream Admin type mapper: {before}")
        patched_config = patched_config.replace(before, after)
    # Correct Zod 4 literal and numeric-enum metadata, normalize validation
    # errors for both generations, and retain legacy schema inspection contracts.
    for before, after, expected in (
        ("const literalValue = innerSchema._def.value;", "const def = innerSchema._def as unknown as { value?: unknown; values?: unknown[] };\n    const literalValue = def.value ?? def.values?.[0];", 1),
        ("result.error.errors.map(", "(result.error.issues ?? result.error.errors).map(", 1),
        ("  return current;\n}\n\nexport function validateFieldValue(", "  if (current?._def && !current._def.typeName) {\n    current._def.typeName = schemaTypeName(current);\n  }\n  return current;\n}\n\nexport function validateFieldValue(", 1),
        ("return `${issuePath}: ${issue.message}`;", "const message = issue.message.startsWith('Invalid input: expected') &&\n          issue.message.includes('received undefined') ? 'Required' : issue.message;\n        return `${issuePath}: ${message}`;", 1),
        ("return `enum(${Array.isArray(values) ? values.join(' | ') : Object.values(values).join(' | ')})`;", "const numeric = Array.isArray(values) ? [] :\n      Object.entries(values).filter(([key, value]) => !/^\\\\d+$/.test(key) && typeof value === 'number');\n    if (numeric.length > 0) {\n      return `enum(${numeric.map(([key, value]) => `${key}=${value}`).join(' | ')})`;\n    }\n    return `enum(${Array.isArray(values) ? values.join(' | ') : Object.values(values).join(' | ')})`;", 1),
    ):
        if patched_config.count(before) != expected:
            raise ValueError(f"Unexpected schema compatibility location: {before}")
        patched_config = patched_config.replace(before, after)
    # For Zod 4 transform pipelines, edit controls must accept the input
    # union, not the transformed output schema (e.g. SearXNG engines).
    for before, after in (
        ("next = current._def.out;", "next = (current._def as unknown as { in?: t.ZodSchemaLike; out?: t.ZodSchemaLike }).in ?? current._def.out;"),
        ("next = def.out;", "next = (def as unknown as { in?: t.ZodSchemaLike; out?: t.ZodSchemaLike }).in ?? def.out;"),
    ):
        if patched_config.count(before) != 1:
            raise ValueError(f"Unexpected upstream transform pipeline: {before}")
        patched_config = patched_config.replace(before, after)
    locale_path = source / "src/locales/en/translation.json"
    locale_content = json.loads(locale_path.read_text())
    translations = {
        "com_config_field_repo": "Repository",
        "com_config_field_ref": "Reference",
        "com_config_field_paths": "Paths",
        "com_config_field_paths_item": "Path",
        "com_config_field_skillDiscoveryDepth": "Skill discovery depth",
        "com_config_field_credentialKey": "Credential key",
        "com_config_field_token": "Token",
    }
    for key, value in translations.items():
        if key in locale_content:
            raise ValueError(f"Unexpected existing Admin locale: {key}")
        locale_content[key] = value
    # The upstream Langfuse UI test races asynchronous connection verification.
    # Retain the exact visibility, enabled-state and API assertions, while
    # awaiting the control before interacting with it.
    langfuse_test = source / "src/components/configuration/sections/__tests__/LangfuseRenderer.test.tsx"
    langfuse_source = langfuse_test.read_text()
    start = "  it('preserves the stored secret when only the public key is edited', async () => {"
    end = "  it('preserves draft fields when shared connection data refreshes', async () => {"
    if langfuse_source.count(start) != 1 or langfuse_source.count(end) != 1:
        raise ValueError("Unexpected upstream Langfuse test structure")
    before_test, remainder = langfuse_source.split(start)
    body, after_test = remainder.split(end)
    old_assertion = """    expect(
      screen.getByRole('button', { name: 'com_config_langfuse_save_and_enable' }),
    ).toBeVisible();"""
    new_assertion = """    expect(
      await screen.findByRole('button', { name: 'com_config_langfuse_save_and_enable' }),
    ).toBeVisible();"""
    old_click = """    fireEvent.click(screen.getByRole('button', { name: 'com_config_langfuse_save_and_enable' }));"""
    new_click = """    const saveButton = await screen.findByRole('button', {
      name: 'com_config_langfuse_save_and_enable',
    });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);"""
    if body.count(old_assertion) != 1 or body.count(old_click) != 1:
        raise ValueError("Unexpected upstream Langfuse async assertion")
    body = body.replace(old_assertion, new_assertion).replace(old_click, new_click)
    langfuse_source = before_test + start + body + end + after_test

    # The disabled-connection test also races asynchronous verification on
    # ARM64; wait for the actionable control without dropping its API assertion.
    second_start = "  it('enables a disabled connection when credential edits are saved with Save & enable', async () => {"
    second_end = "  it('re-verifies the stored connection when an invalid key edit is cancelled', async () => {"
    if langfuse_source.count(second_start) != 1 or langfuse_source.count(second_end) != 1:
        raise ValueError("Unexpected upstream disabled Langfuse test structure")
    before_second, remainder = langfuse_source.split(second_start)
    second_body, after_second = remainder.split(second_end)
    if second_body.count(old_click) != 1:
        raise ValueError("Unexpected upstream disabled Langfuse Save & enable assertion")
    second_body = second_body.replace(old_click, new_click)
    langfuse_source = before_second + second_start + second_body + second_end + after_second

    # Validate all expected upstream patterns before any source mutation.
    package.write_text(json.dumps(document, indent=2) + "\n")
    dockerfile.write_text(upgraded)
    config_file.write_text(patched_config)
    locale_path.write_text(json.dumps(locale_content, indent=2, ensure_ascii=False) + "\n")
    langfuse_test.write_text(langfuse_source)

    print(f"Prepared isolated Admin source at {UPSTREAM_SHA}; no image published")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_omni_admin_candidate.py <disposable-upstream-checkout>")
    stage(Path(sys.argv[1]))
