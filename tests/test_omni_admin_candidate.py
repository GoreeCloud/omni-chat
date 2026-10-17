"""Regression tests for the isolated Admin source preparation contract."""
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECIPE = ROOT / "scripts" / "prepare_omni_admin_candidate.py"


class AdminCandidateGuardTests(unittest.TestCase):
    def test_rejects_unrelated_repository_without_mutating_it(self):
        dockerfile = ROOT / "Dockerfile"
        before = dockerfile.read_bytes()
        result = subprocess.run(
            [sys.executable, str(RECIPE), str(ROOT)],
            capture_output=True, text=True, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Refusing unverified Admin Panel source", result.stderr)
        self.assertEqual(dockerfile.read_bytes(), before)

    def test_pinned_version_and_immutability_guards(self):
        code = RECIPE.read_text()
        for token in (
            "82fb4b61409d5c2e6eceb3d116b89bc957c1620e",
            "Refusing to modify a dirty upstream checkout",
            "Unexpected upstream Dockerfile, refusing mutation",
            "bun prune --production",
            "RUN apk upgrade --no-cache",
            '"tmp": "0.2.7"',
            'Unexpected upstream disabled Langfuse Save & enable assertion',
            'second_body = second_body.replace(old_click, new_click)',
        ):
            with self.subTest(token=token):
                self.assertIn(token, code)

    def test_validates_langfuse_patch_targets_before_any_source_write(self):
        code = RECIPE.read_text()
        self.assertLess(
            code.index('second_body = second_body.replace(old_click, new_click)'),
            code.index('package.write_text('),
            'Expected pinned upstream test validation before any file mutation',
        )
        self.assertIn('await waitFor(() => expect(saveButton).toBeEnabled())', code)
        self.assertIn('if second_body.count(old_click) != 1:', code)


if __name__ == "__main__":
    unittest.main()
