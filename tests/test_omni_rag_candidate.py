"""RAG pinned-source preparation guards; all fixtures are synthetic."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare_omni_rag_candidate.py"
SPEC = importlib.util.spec_from_file_location("prepare_omni_rag_candidate", SCRIPT)
candidate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(candidate)

PERMISSIVE = '''    if not jwt_secret:
        logger.warn("JWT_SECRET not found in environment variables")
        return await next_middleware_call()'''


class PinnedRagCandidateTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="omni-rag-guard-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "app").mkdir()
        self.original = {
            "requirements.lite.txt": "PyJWT==2.13.0\nfastapi==0.115.12\n",
            "Dockerfile.lite": "FROM python:3.12-slim AS lite\n",
            "LICENSE": "MIT License\nSynthetic licensed fixture.\n",
            "app/middleware.py": (
                "async def auth(next_middleware_call, jwt_secret):\n"
                + PERMISSIVE
                + '\n        logger.debug(f"{request.url.path} - {payload}")\n'
            ),
        }
        for name, text in self.original.items():
            (self.root / name).write_text(text, encoding="utf-8")

    def run_stage(self, revision=None, dirty=False):
        with patch.object(
            candidate.subprocess,
            "check_output",
            side_effect=[
                (revision or candidate.UPSTREAM_SHA) + "\n",
                "?? changed-file\n" if dirty else "",
            ],
        ):
            candidate.stage(self.root)

    def assert_unmodified(self):
        for name, text in self.original.items():
            self.assertEqual((self.root / name).read_text(encoding="utf-8"), text, name)
        self.assertFalse((self.root / "Dockerfile.noble-trial").exists())
        self.assertFalse((self.root / "goree-rag-candidate.json").exists())

    def test_mismatched_source_revision_rejects_before_mutation(self):
        with self.assertRaisesRegex(ValueError, "revision mismatch"):
            self.run_stage(revision="0" * 40)
        self.assert_unmodified()

    def test_dirty_upstream_checkout_rejects_before_mutation(self):
        with self.assertRaisesRegex(ValueError, "dirty pinned RAG checkout"):
            self.run_stage(dirty=True)
        self.assert_unmodified()

    def test_unexpected_jwt_middleware_rejects_without_partial_rewrite(self):
        invalid = self.original["app/middleware.py"].replace(
            'return await next_middleware_call()', 'return True'
        )
        (self.root / "app/middleware.py").write_text(invalid, encoding="utf-8")
        self.original["app/middleware.py"] = invalid
        with self.assertRaisesRegex(ValueError, "Unexpected upstream RAG JWT middleware"):
            self.run_stage()
        self.assert_unmodified()

    def test_unexpected_jwt_payload_debug_log_rejects_before_mutation(self):
        invalid = self.original["app/middleware.py"].replace(
            'logger.debug(f"{request.url.path} - {payload}")',
            'logger.debug("changed-upstream-log-contract")',
        )
        (self.root / "app/middleware.py").write_text(invalid, encoding="utf-8")
        self.original["app/middleware.py"] = invalid
        with self.assertRaisesRegex(ValueError, "Unexpected upstream RAG JWT payload debug logging"):
            self.run_stage()
        self.assert_unmodified()

    def test_conflicting_existing_dependency_pin_rejects_without_mutation(self):
        invalid = self.original["requirements.lite.txt"] + "urllib3==0.0.1\n"
        (self.root / "requirements.lite.txt").write_text(invalid, encoding="utf-8")
        self.original["requirements.lite.txt"] = invalid
        with self.assertRaisesRegex(ValueError, "Unexpected existing RAG constraint"):
            self.run_stage()
        self.assert_unmodified()

    def test_success_stages_only_patched_source_and_manifest(self):
        self.run_stage()
        requirements = (self.root / "requirements.lite.txt").read_text()
        for dependency in (
            "PyJWT==2.15.0",
            "fastapi==0.143.3",
            "starlette==1.8.0",
            "msgpack==1.2.1",
            "setuptools==80.10.2",
            "urllib3==2.8.0",
        ):
            self.assertIn(dependency, requirements)
        middleware = (self.root / "app/middleware.py").read_text()
        self.assertIn("status_code=503", middleware)
        self.assertNotIn("return await next_middleware_call()", middleware)
        self.assertIn('logger.debug("Authenticated RAG request")', middleware)
        self.assertNotIn('logger.debug(f"{request.url.path} - {payload}")', middleware)
        manifest = (self.root / "goree-rag-candidate.json").read_text()
        self.assertIn(candidate.UPSTREAM_SHA, manifest)
        self.assertIn('"qualification_only": true', manifest)
        self.assertIn("FROM ubuntu:24.04", (self.root / "Dockerfile.noble-trial").read_text())
        self.assertEqual((self.root / "Dockerfile.lite").read_text(), self.original["Dockerfile.lite"])
        self.assertEqual((self.root / "LICENSE").read_text(), self.original["LICENSE"])


if __name__ == "__main__":
    unittest.main()
