"""Contract tests for the OCI audit's fail-closed release gate."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "scripts" / "omni_oci_gate.py"
REF = "example.invalid/team/image@sha256:" + "a" * 64


def fixture(arch="amd64", severity="CRITICAL", fixed="1.2.3"):
    return {
        "ArtifactName": REF,
        "Metadata": {"ImageConfig": {"os": "linux", "architecture": arch}},
        "Results": [{"Type": "python-pkg", "Vulnerabilities": [{
            "VulnerabilityID": "CVE-2099-9999",
            "PkgName": "example",
            "InstalledVersion": "1.0.0",
            "FixedVersion": fixed,
            "Severity": severity,
        }]}],
    }


class ImageAuditGate(unittest.TestCase):
    def evaluate(self, report, arch="amd64"):
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "report.json"
            path.write_text(json.dumps(report), encoding="utf-8")
            return subprocess.run(
                [sys.executable, str(TOOL), "--report", str(path), "--image", REF,
                 "--arch", arch, "--max-critical", "0"],
                capture_output=True, text=True, check=False,
            )

    def test_critical_findings_block_release_even_with_fix(self):
        outcome = self.evaluate(fixture())
        self.assertEqual(outcome.returncode, 1)
        self.assertIn("CVE-2099-9999", outcome.stdout)
        self.assertIn("BLOCKED", outcome.stderr)

    def test_high_without_critical_is_not_automatically_release_approved(self):
        outcome = self.evaluate(fixture(severity="HIGH"))
        self.assertEqual(outcome.returncode, 0)
        self.assertIn("Other security gates", outcome.stdout)

    def test_platform_mismatch_fails_closed(self):
        outcome = self.evaluate(fixture(), arch="arm64")
        self.assertEqual(outcome.returncode, 2)
        self.assertIn("Wrong OCI platform", outcome.stderr)

    def test_digest_mismatch_fails_closed(self):
        record = fixture()
        record["ArtifactName"] = "example.invalid/team/image:latest"
        outcome = self.evaluate(record)
        self.assertEqual(outcome.returncode, 2)

    def test_missing_results_fails_closed(self):
        record = fixture()
        record["Results"] = []
        outcome = self.evaluate(record)
        self.assertEqual(outcome.returncode, 2)

    def test_missing_architecture_fails_closed(self):
        record = fixture()
        record["Metadata"]["ImageConfig"].pop("architecture")
        outcome = self.evaluate(record)
        self.assertEqual(outcome.returncode, 2)


if __name__ == "__main__":
    unittest.main()
