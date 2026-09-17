# 开始一份作业

1. 从本期题库选择一道题，确认采用的题面版本与范围。
2. 新建独立的私有学员仓库，复制 `templates/student-repo/` 的全部内容，包括 `.github/`。
3. 用对应的 `assignments/<题目>/student-visible/ASSIGNMENT.md` 替换模板中的 `ASSIGNMENT.md`。
4. 在学员仓库根目录运行 `python3 scripts/check_submission.py --root . --template`。
5. 按活动流程完成澄清、计划、实现、验证、交付与复盘。

本期题库为公开草案；公开不代表正式活动安排或最终验收定稿。学员仓库默认私有，公开成果前须清理敏感信息并获得相关参与者同意。组织者隐藏验收、参考答案与私密反馈不属于本公开仓库。

检查脚本只检查提交结构、占位符和常见敏感信息风险，不代替功能测试或人工判断。
