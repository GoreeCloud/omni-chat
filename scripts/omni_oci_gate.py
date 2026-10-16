#!/usr/bin/env python3
"""Fail closed on unsafe third-party OCI scan results; stdlib only."""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
from pathlib import Path
import sys

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN")


def summarize(report: dict, expected_image: str, expected_arch: str) -> tuple[str, int]:
    if not isinstance(report, dict):
        raise ValueError("Trivy report must be a JSON object")
    if report.get("ArtifactName") != expected_image:
        raise ValueError("Scanned image reference differs from the immutable digest")
    if "@sha256:" not in expected_image:
        raise ValueError("Expected OCI image must be pinned to a digest")
    config = (report.get("Metadata") or {}).get("ImageConfig") or {}
    observed_arch = config.get("architecture")
    observed_os = config.get("os")
    if observed_os != "linux" or observed_arch != expected_arch:
        raise ValueError(
            f"Wrong OCI platform: expected linux/{expected_arch}, observed {observed_os}/{observed_arch}"
        )
    results = report.get("Results")
    if not isinstance(results, list) or not results:
        raise ValueError("Missing image scan results; no evidence to approve")
    vulnerabilities = []
    for result in results:
        if not isinstance(result, dict):
            raise ValueError("Invalid Trivy result entry")
        entries = result.get("Vulnerabilities") or []
        if not isinstance(entries, list):
            raise ValueError("Invalid Trivy vulnerability entries")
        vulnerabilities.extend(entries)
    counts = Counter(v.get("Severity", "UNKNOWN") for v in vulnerabilities)
    fixable = Counter(
        v.get("Severity", "UNKNOWN") for v in vulnerabilities if v.get("FixedVersion")
    )
    unique_critical = len(
        {v.get("VulnerabilityID") for v in vulnerabilities if v.get("Severity") == "CRITICAL"}
    )
    lines = [
        f"### OCI image: {expected_arch}",
        f"- Immutable reference: \`{expected_image}\`",
        f"- Observed platform: linux/{observed_arch}",
        f"- Findings are package instances, not distinct CVEs or exploitability proofs.",
    ]
    for severity in SEVERITIES:
        lines.append(
            f"- {severity}: {counts[severity]} findings; {fixable[severity]} have fixes listed"
        )
    lines.append(f"- Unique critical CVE IDs: {unique_critical}")
    for item in (v for v in vulnerabilities if v.get("Severity") == "CRITICAL"):
        lines.append(
            f"  - {item.get('VulnerabilityID')}: {item.get('PkgName')} "
            f"{item.get('InstalledVersion')} -> {item.get('FixedVersion') or 'no fix listed'}"
        )
    return "\n".join(lines) + "\n", counts["CRITICAL"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--arch", choices=("amd64", "arm64"), required=True)
    parser.add_argument("--max-critical", type=int, default=0)
    args = parser.parse_args(argv)
    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
        summary, critical = summarize(report, args.image, args.arch)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"OCI audit cannot validate evidence: {exc}", file=sys.stderr)
        return 2
    print(summary)
    if path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(path, "a", encoding="utf-8") as out:
            out.write(summary)
    if critical > args.max_critical:
        print(
            f"OCI release gate BLOCKED: {critical} CRITICAL findings, "
            f"limit {args.max_critical}",
            file=sys.stderr,
        )
        return 1
    print("No critical package findings. Other security gates still required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
