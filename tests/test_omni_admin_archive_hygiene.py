"""Synthetic regression for the Admin corresponding-source archive."""
import shlex
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/omni-chat-admin-candidate.yml"

class AdminSourceArchiveTests(unittest.TestCase):
    def test_archive_excludes_generated_and_local_files(self):
        text = WORKFLOW.read_text()
        begin = "tar --create --gzip --file admin-modified-source.tar.gz"
        end = "tar -tzf admin-modified-source.tar.gz"
        self.assertEqual(text.count(begin), 1)
        block = begin + text.split(begin, 1)[1].split(end, 1)[0]
        cmd = shlex.split(block.replace("\\\n", " "))
        self.assertEqual(cmd[:4], ["tar", "--create", "--gzip", "--file"])
        self.assertIn("--directory=admin-src", cmd)

        with tempfile.TemporaryDirectory(prefix="admin-archive-") as temp:
            base = Path(temp)
            src = base / "source"
            required = ["LICENSE", "Dockerfile", "bun.lock",
                        "src/server/config.ts", "src/components/Login.tsx"]
            forbidden = ["logs/audit.json", "dist/client/index.js",
                         ".tanstack/tmp/manifest.json", "coverage/report.txt",
                         "node_modules/module/index.js", ".git/config",
                         ".output/server/index.js", ".env", ".env.local",
                         ".env.production", ".env.example"]
            for name in required + forbidden:
                dst = src / name
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_text("synthetic fixture\n")

            archive = base / "candidate.tar.gz"
            cmd[4] = str(archive)
            cmd[cmd.index("--directory=admin-src")] = f"--directory={src}"
            subprocess.run(cmd, check=True, cwd=base, capture_output=True, text=True)
            names = set(subprocess.check_output(
                ["tar", "-tzf", str(archive)], text=True
            ).splitlines())
            for name in required:
                self.assertIn("./" + name, names)
            for name in forbidden:
                self.assertNotIn("./" + name, names)

if __name__ == "__main__":
    unittest.main()
