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
    package.write_text(json.dumps(document, indent=2) + "\n")
    dockerfile.write_text(upgraded)
    print(f"Prepared isolated Admin source at {UPSTREAM_SHA}; no image published")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_omni_admin_candidate.py <disposable-upstream-checkout>")
    stage(Path(sys.argv[1]))
