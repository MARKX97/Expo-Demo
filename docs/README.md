# 仓库知识索引

版本：0.2

最后审校：2026-07-25

## 目的

本目录是产品、技术和验证知识的事实源。`AGENTS.md` 只负责把开发工具路由到这里，不复制详细规则。

状态定义：

- `已定义`：文档契约完整，但代码或自动化尚未落地。
- `已实现`：已有代码，尚未取得全部交付证据。
- `已验证`：实现通过对应自动检查和人工验收。

## 事实源目录

| 领域 | 唯一事实源 | 当前状态 | 主要验证证据 |
| --- | --- | --- | --- |
| 产品范围与验收 | [`prd.md`](prd.md) | 已定义 | 验收 ID 与测试映射 |
| 总体架构 | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | 已实现 | typecheck、lint、结构审查 |
| 前端与交互 | [`FRONTEND.md`](FRONTEND.md) | 已实现 | Jest、RNTL、Maestro flow；双端执行待补 |
| 后端与数据库 | [`BACKEND.md`](BACKEND.md) | 已实现 | migration、pgTAP 已落盘；本地执行待补 |
| 前后端接口对接 | [`API_CONTRACT.md`](API_CONTRACT.md) | 已实现 | Service/RPC 已对齐；集成测试待补 |
| 测试与质量门禁 | [`TESTING.md`](TESTING.md) | 已实现 | 静态/单元/文档通过；DB、集成、E2E 执行待补 |
| Android/iOS 运行 | [`RUNBOOK.md`](RUNBOOK.md) | 已定义 | EAS build、真机验收 |
| Agent 开发护栏 | [`HARNESS.md`](HARNESS.md) | 已定义 | 文档检查、review 清单 |
| 视觉规范 | [`../design-system/电梯故障派工/MASTER.md`](../design-system/电梯故障派工/MASTER.md) | 已定义 | UI/a11y 验收 |
| AI 开发记录 | [`ai-chat-history.jsonl`](ai-chat-history.jsonl) | 已生成 | 非门禁记录；交付前补齐 |

仓库已落地 P0/P1 业务页面、Service、Supabase migration、pgTAP、前端测试，以及 P2
Maestro flow 与 EAS 双平台测试构建配置。真实 Supabase 重放/集成、EAS 构建、Maestro
运行和双端真机证据尚未完成，因此产品实现仍不能标记为“已验证”。

## 变更路由

| 发生变化 | 必须同步 |
| --- | --- |
| 产品行为、角色、状态 | PRD → FRONTEND/BACKEND/API_CONTRACT → TESTING |
| 页面、路由、交互、文案 | FRONTEND → TESTING → UI 实现 |
| 表、RPC、RLS、Storage | BACKEND → migration/types → TESTING |
| Service 方法、参数、响应或错误 | API_CONTRACT → FRONTEND/BACKEND → 集成测试 |
| 原生依赖、权限、EAS | RUNBOOK → app/eas config → TESTING |
| 测试命令、CI 或质量门禁 | TESTING → HARNESS → `package.json`/workflow |
| 重复出现的缺陷或 review 意见 | 对应事实源 → 测试/lint/constraint |

## 冲突处理

1. 产品行为以 `prd.md` 为准。
2. 页面行为以 `FRONTEND.md`、数据库规则以 `BACKEND.md`、前后端调用以
   `API_CONTRACT.md` 为准；三者不得改变 PRD。
3. migration 是已实现数据库结构的事实源；若与 `BACKEND.md` 或
   `API_CONTRACT.md` 不一致，变更不能合并。
4. 可执行测试描述当前实现，测试与需求冲突时不能通过降低断言来“修复”。

## 执行计划

小改动使用任务内计划即可。满足任一条件时，才创建
`docs/exec-plans/active/<slug>.md`：

- 跨前端、数据库和 EAS 三个区域；
- 预计超过一个工作日；
- 涉及不可逆 migration、认证或权限迁移；
- 需要分阶段上线或人工决策。

计划至少记录目标、非目标、验收 ID、进度、关键决策和回滚方式。完成后移动到 `docs/exec-plans/completed/`；不要预建空目录。

## 维护规则

- 每个 PR 检查本索引链接和状态。
- 文档状态只能随同验证证据升级，不能凭实现者描述升级。
- 发现陈旧规则时，优先修正文档并增加机械检查。
- AI 对话记录文件保留在仓库。Agent 可自行选择刷新时机，但任务交付、提交推送或交接前必须完整记录全部新增的用户与助手可见消息并去重；不得写入凭据、内部推理、原始工具输出或本机临时路径。该要求仅是记录规范，不属于测试或 `verify` 门禁。
- 测试截图、视频和日志作为 CI/EAS artifact 保存，不提交生成物到 Git。
