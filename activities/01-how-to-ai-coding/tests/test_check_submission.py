from __future__ import annotations

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = PROJECT_ROOT / "templates" / "student-repo" / "scripts" / "check_submission.py"
SPEC = importlib.util.spec_from_file_location("check_submission", SCRIPT_PATH)
assert SPEC and SPEC.loader
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class SubmissionCheckTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "student-repo"
        shutil.copytree(PROJECT_ROOT / "templates" / "student-repo", self.root)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_template_structure_passes(self):
        errors, _ = CHECKER.check(self.root, template_mode=True)
        self.assertEqual([], errors)

    def test_unfinished_submission_is_rejected(self):
        errors, _ = CHECKER.check(self.root, template_mode=False)
        self.assertTrue(any("占位符" in error for error in errors))
        self.assertTrue(any("运行或测试证据" in error for error in errors))

    def test_common_secret_and_sensitive_file_are_rejected(self):
        fake_token = "ghp_" + ("a" * 24)
        (self.root / "notes.md").write_text(f"example {fake_token}", encoding="utf-8")
        (self.root / ".env.local").write_text("SAFE_PLACEHOLDER=true", encoding="utf-8")
        errors, _ = CHECKER.check(self.root, template_mode=True)
        self.assertTrue(any("GitHub token" in error for error in errors))
        self.assertTrue(any("疑似敏感文件" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
