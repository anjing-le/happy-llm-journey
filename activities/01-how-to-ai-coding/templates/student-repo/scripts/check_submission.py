#!/usr/bin/env python3
"""技术栈中立的安静 AI-Coding 作业基础检查。随学员仓库分发。"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_SECTIONS = {
    "ASSIGNMENT.md": [
        "项目背景",
        "项目目标",
        "用户故事",
        "功能要求",
        "非功能要求",
        "范围与限制",
        "澄清机制",
        "交付物与证据",
        "可测试验收标准",
        "技术讲解与追问准备",
        "安全与合规",
    ],
    "README.md": [
        "项目概览",
        "完成范围",
        "技术方案",
        "安装与运行",
        "测试与验证",
        "提交摘要",
        "已知限制",
    ],
    "docs/PRD.md": [
        "问题与目标",
        "用户与场景",
        "用户故事",
        "需求与优先级",
        "非功能要求",
        "范围与非目标",
        "验收标准",
        "澄清、假设与决策",
    ],
    "docs/PLAN.md": [
        "方案摘要",
        "架构与模块",
        "里程碑",
        "测试策略",
        "风险与降级",
        "外部依赖与安全",
        "提交计划",
    ],
    "docs/TEST_EVIDENCE.md": [
        "验证环境",
        "自动化测试",
        "运行或部署验证",
        "验收标准映射",
        "失败、边界与回归",
        "证据清单",
    ],
    "docs/AI_COLLABORATION.md": [
        "使用范围",
        "关键协作记录",
        "本人关键判断",
        "AI 输出核验",
        "个人贡献边界",
        "未采纳建议",
    ],
    "docs/RETROSPECTIVE.md": [
        "结果摘要",
        "做得好的地方",
        "最大困难与解决方式",
        "返工与临时需求",
        "如果重来一次",
        "遗留问题与下一步",
        "技术讲解提纲",
    ],
    ".github/PULL_REQUEST_TEMPLATE.md": [
        "阶段与目标",
        "变更摘要",
        "验收标准映射",
        "测试与运行证据",
        "AI 协作与本人判断",
        "风险与已知限制",
        "提交前检查",
    ],
}

SECRET_PATTERNS = {
    "AWS access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "GitHub token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})"),
    "OpenAI-style key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "Slack token": re.compile(r"xox[baprs]-[A-Za-z0-9-]{16,}"),
    "Google API key": re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    "private key block": re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
}

PLACEHOLDERS = ("[请填写", "[组织者填写", "<assignment-id>", "<learner-id>")
UNSAFE_SUFFIXES = {".pem", ".p12", ".pfx", ".key", ".keystore"}
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "vendor", "__pycache__"}


def markdown_headings(text: str) -> set[str]:
    headings: set[str] = set()
    for line in text.splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*$", line)
        if match:
            headings.add(match.group(1).strip())
    return headings


def iter_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        yield path


def check(root: Path, template_mode: bool = False) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not root.is_dir():
        return [f"检查目录不存在：{root}"], warnings

    for relative, required_sections in REQUIRED_SECTIONS.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"缺少必要文件：{relative}")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if not text.strip():
            errors.append(f"必要文件为空：{relative}")
            continue
        headings = markdown_headings(text)
        for section in required_sections:
            if section not in headings:
                errors.append(f"{relative} 缺少章节：{section}")
        if not template_mode and any(marker in text for marker in PLACEHOLDERS):
            errors.append(f"{relative} 仍含未清理占位符")

    evidence_dir = root / "evidence"
    if not evidence_dir.is_dir():
        errors.append("缺少证据目录：evidence/")
    elif not template_mode:
        artifacts = [path for path in evidence_dir.rglob("*") if path.is_file() and path.name != "README.md"]
        if not artifacts:
            errors.append("evidence/ 中没有 README.md 之外的运行或测试证据")

    for path in iter_files(root):
        relative = path.relative_to(root)
        name = path.name.lower()
        if (name == ".env" or (name.startswith(".env.") and name != ".env.example")) or path.suffix.lower() in UNSAFE_SUFFIXES:
            errors.append(f"疑似敏感文件：{relative}")

        if path.stat().st_size > 2_000_000:
            warnings.append(f"未扫描超过 2 MB 的文件：{relative}")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                errors.append(f"{relative} 命中常见敏感信息模式：{label}")

    return sorted(set(errors)), sorted(set(warnings))


def main() -> int:
    parser = argparse.ArgumentParser(description="检查作业必要文件、章节、证据与常见敏感信息风险")
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="学员仓库根目录")
    parser.add_argument("--template", action="store_true", help="验证模板结构，允许占位符且不要求实际证据文件")
    args = parser.parse_args()

    errors, warnings = check(args.root.resolve(), args.template)
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        print(f"FAIL: {len(errors)} 个错误，{len(warnings)} 个警告")
        return 1
    print(f"PASS: 基础检查通过，{len(warnings)} 个警告")
    return 0


if __name__ == "__main__":
    sys.exit(main())
