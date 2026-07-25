# 通用 AI 开发入口

本文件是 Codex 与 Claude Code 共用的仓库规则，只做入口地图，不复制完整说明。

## 工具入口

| 工具 | 自动入口 | 规则来源 |
| --- | --- | --- |
| Codex | `AGENTS.md` | 直接读取本文件 |
| Claude Code | `CLAUDE.md` | 通过 `@AGENTS.md` 导入本文件 |

不得在 `CLAUDE.md` 复制规则；通用规则只维护在本文件。

## 事实源

完整索引见 `docs/README.md`。

1. `docs/prd.md`：产品范围、角色、主流程和验收标准。
2. `docs/BACKEND.md`：数据库、关系、RPC、RLS 和 Storage 契约。
3. `docs/FRONTEND.md`：页面、交互、客户端状态和 API 对接。
4. `ARCHITECTURE.md`：层级边界、依赖方向和目录结构。
5. `docs/API_CONTRACT.md`：页面、Service 与 Supabase 接口的唯一对接契约。
6. `design-system/电梯故障派工/MASTER.md`：视觉、触控和可访问性规则。
7. `docs/RUNBOOK.md`：Android/iOS 开发与内部安装流程。
8. `docs/TESTING.md`：测试层级、验收映射、CI/E2E 和证据。
9. `docs/HARNESS.md`：变更级联、验证和 review 护栏。

冲突时按以上顺序处理；不能自行猜测业务。发现冲突先更新上层事实源，再改代码。

## 任务文档路由

开始开发前必须先读 `docs/prd.md` 和 `ARCHITECTURE.md`，再按任务读取：

| 任务涉及 | 必须追加阅读 |
| --- | --- |
| 页面、交互、状态或文案 | `docs/FRONTEND.md`、设计系统 |
| 表、字段、认证、RPC、RLS 或 Storage | `docs/BACKEND.md` |
| Service、查询、请求响应、错误或前后端联调 | `docs/API_CONTRACT.md` |
| Expo、原生配置、环境变量或 EAS | `docs/RUNBOOK.md` |
| 测试、CI、E2E、验收或缺陷回归 | `docs/TESTING.md` |
| 工程约束、验证或文档同步 | `docs/HARNESS.md` |

任务跨多个区域时合并阅读对应文档；不要无差别加载全部文档。

## 不可破坏的产品约束

- 移动端使用 Expo + TypeScript，不使用 Expo Go。
- 后端使用 Supabase Auth、Postgres、Storage；V1 不新增自建 Node 服务。
- 不开放注册。账号由管理员在 Supabase 控制台预创建。
- 角色只有 `elevator_supervisor` 与 `elevator_engineer`。
- 工单状态只有 `assigned -> in_progress -> closed`，不可逆。
- 主管只能改派 `assigned` 工单；工程师只能处理分配给自己的工单。
- 关闭必须填写处理结果，关闭后只读。
- 新建工单必须有 1–3 张照片；全部上传成功后才能创建记录。
- 客户端永远不能包含 Supabase `service_role` key。
- 紧急工单只做置顶和标识，不替代线下救援流程。

## 实现边界

- 所有源码、Supabase migration、文档和交付记录保存在同一 Git 仓库。
- 业务代码使用 TypeScript；配置、SQL、Markdown 和纯 HTML 原型使用对应原生格式。
- 依赖方向：`types -> lib -> services -> screens/components -> app wiring`。
- 页面不能直接拼装 Supabase 查询；统一放在业务 service。
- 数据库状态变更通过文档定义的 RPC 完成，客户端不直接更新受保护字段。
- 数据库 migration 是 schema 事实源；生成的 TypeScript 类型不得手写修改。
- V1 不新增 Redux、ORM、自建 API、消息队列、推送、离线同步或设备台账。

## 工作流程

1. 阅读当前任务涉及的事实源和调用链。
2. 先更新相关文档，再实现最小代码变更。
3. 修改表、枚举、RPC 或权限时，同一变更必须更新 `docs/BACKEND.md`。
4. 修改页面、路由、文案或交互时，同一变更必须更新 `docs/FRONTEND.md`。
5. 新增构建依赖或原生配置时，同一变更必须更新 `docs/RUNBOOK.md`。
6. 修改行为或修复缺陷时，同一变更必须更新对应测试和验收映射。
7. 实现后运行 `pnpm run verify` 与任务要求的 E2E/UAT；具体门禁见 `docs/TESTING.md`。
8. Agent 自行选择 `docs/ai-chat-history.jsonl` 的刷新时机；每次任务交付、提交推送或交接前必须补齐自上次导出后的全部用户与助手可见消息并去重。不得写入系统/开发者指令、内部推理、原始工具输出、凭据和本机临时绝对路径。该文件仅用于记录，不属于测试或 `verify` 门禁。

## 完成定义

- 代码、文档、migration 与生成类型一致。
- `README.md` 与 `docs/prd.md` 保持可交付。
- PRD 验收 ID 均映射到测试，`pnpm run verify` 通过。
- 每个页面操作均能在 `API_CONTRACT.md` 追踪到 Service、后端接口、错误和测试。
- 没有把凭据、`.env` 或真实用户数据提交到 Git。
- Android/iOS 对应 build profile 可生成并安装。
- App/后端变更取得对应 Maestro 或真机验收证据。
- 所有异步操作有 loading、error 和 retry；重复提交被禁用。
- 触控目标不小于 44pt，状态不只依赖颜色表达。
