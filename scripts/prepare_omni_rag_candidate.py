#!/usr/bin/env python3
"""Prepare a disposable, pinned RAG API checkout for Ubuntu 24.04 qualification.

No credentials, real data, image publication or deployments are involved.
"""
from pathlib import Path
import json
import subprocess
import sys

UPSTREAM_SHA = "c4e5cbf79fcece1df9adfff5dfed983a5990ca9f"
UPGRADES = {"PyJWT": ("2.13.0", "2.15.0"), "fastapi": ("0.115.12", "0.143.3")}
STARLETTE = "1.8.0"
TRANSITIVE_SECURITY_PINS = {"msgpack": "1.2.1", "setuptools": "80.10.2", "urllib3": "2.8.0"}

DOCKERFILE = """FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends python3.12 python3.12-venv ca-certificates pandoc netcat-openbsd libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN python3.12 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" SCARF_NO_ANALYTICS=true
WORKDIR /app
COPY requirements.lite.txt .
RUN pip install --no-cache-dir --upgrade pip==26.2.0 && pip install --no-cache-dir -r requirements.lite.txt && pip check && python -m pip uninstall -y pip
COPY . .
CMD ["python","main.py"]
"""


def stage(source: Path) -> None:
    root = source.resolve(strict=True)
    revision = subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
    ).strip()
    if revision != UPSTREAM_SHA:
        raise ValueError(f"RAG source revision mismatch: {revision}")
    status = subprocess.check_output(
        ["git", "-C", str(root), "status", "--porcelain"], text=True
    ).strip()
    if status:
        raise ValueError("Refusing a dirty pinned RAG checkout")
    requirements = root / "requirements.lite.txt"
    original = requirements.read_text()
    license_text = (root / "LICENSE").read_text()
    original_dockerfile = (root / "Dockerfile.lite").read_text()
    if not license_text.startswith("MIT License"):
        raise ValueError("Unexpected upstream RAG license")
    if "FROM python:3.12-slim AS lite" not in original_dockerfile:
        raise ValueError("Unexpected upstream RAG Dockerfile layout")
    if "starlette==" in original.lower():
        raise ValueError("Unexpected preexisting direct Starlette constraint")

    changed = original
    for package, (old, new) in UPGRADES.items():
        before = f"{package}=={old}"
        if changed.count(before) != 1:
            raise ValueError(f"Unexpected RAG dependency constraint: {before}")
        changed = changed.replace(before, f"{package}=={new}")
    fastapi_version = "fastapi==0.143.3"
    changed = changed.replace(fastapi_version, fastapi_version + "\nstarlette==" + STARLETTE)
    # Pin patched transitive dependencies found in exact-head Trivy scan.
    # Reject an upstream change before introducing potentially conflicting pins.
    for package, version in TRANSITIVE_SECURITY_PINS.items():
        if any(line.strip().lower().startswith(package + op)
               for line in original.splitlines()
               for op in ("==", ">=", "<=", "~=", ">", "<")):
            raise ValueError(f"Unexpected existing RAG constraint: {package}")
        changed += f"\n{package}=={version}"
    changed += "\n"

    manifest = {
        "upstream_repository": "LibreChat-AI/rag-api",
        "upstream_sha": UPSTREAM_SHA,
        "upstream_license": "MIT",
        "candidate_base": "ubuntu:24.04",
        "candidate_runtime_dockerfile": "Dockerfile.noble-trial",
        "dependency_updates": {
            "PyJWT": UPGRADES["PyJWT"][1],
            "fastapi": UPGRADES["fastapi"][1],
            "starlette": STARLETTE,
            **TRANSITIVE_SECURITY_PINS,
        },
        "qualification_only": True,
    }

    # Upstream currently calls the downstream handler when JWT_SECRET is
    # missing. Fail closed for protected endpoints; health/docs remain exempt.
    middleware_path = root / "app/middleware.py"
    middleware = middleware_path.read_text()
    permissive = """    if not jwt_secret:
        logger.warn("JWT_SECRET not found in environment variables")
        return await next_middleware_call()"""
    guarded = """    if not jwt_secret:
        logger.error("JWT_SECRET missing; refusing protected RAG request")
        return JSONResponse(
            status_code=503, content={"detail": "Authentication is unavailable"}
        )"""
    if middleware.count(permissive) != 1:
        raise ValueError("Unexpected upstream RAG JWT middleware behavior")
    middleware = middleware.replace(permissive, guarded)

    requirements.write_text(changed)
    middleware_path.write_text(middleware)
    (root / "Dockerfile.noble-trial").write_text(DOCKERFILE)
    (root / "goree-rag-candidate.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared isolated RAG candidate at {UPSTREAM_SHA}; no image published")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_omni_rag_candidate.py <disposable-upstream-checkout>")
    stage(Path(sys.argv[1]))
