# 电梯故障派工与交接 App

Expo + TypeScript 移动端 PoC，后端使用 Supabase Auth、Postgres 与 Storage。产品不发布到应用商店，通过 EAS development/preview build 安装到 Android 或 iOS 测试设备。

## 仓库导航

- [仓库知识索引](docs/README.md)
- [产品需求](docs/prd.md)
- [Android / iOS 运行手册](docs/RUNBOOK.md)
- [总体架构](ARCHITECTURE.md)
- [Harness Engineering 开发护栏](docs/HARNESS.md)
- [前端技术设计](docs/FRONTEND.md)
- [后端与数据库设计](docs/BACKEND.md)
- [前后端对接契约](docs/API_CONTRACT.md)
- [测试与质量策略](docs/TESTING.md)
- [设计系统](design-system/电梯故障派工/MASTER.md)
- [纯 HTML 交互原型](prototype/index.html)
- [AI 开发对话记录](docs/ai-chat-history.jsonl)

## 当前阶段

当前仓库完成产品、架构、运行和前后端契约设计，并提供无需构建的 HTML 原型。Expo 应用源码与 Supabase migration 尚未开始。

Codex 自动读取 [AGENTS.md](AGENTS.md)；Claude Code 自动读取
[CLAUDE.md](CLAUDE.md)，后者导入同一份通用规则。两种工具都必须按入口中的任务路由读取相关文档，不得绕过角色、状态机与 RLS 约束。

## 交付约束

- 使用单一 Git 仓库保存 Expo、Supabase、文档和开发记录。
- 业务代码使用 TypeScript，移动端使用 Expo。
- Android/iOS 的详细运行方式见 [运行手册](docs/RUNBOOK.md)。
- 仓库必须包含本文件、`docs/prd.md` 和脱敏后的
  `docs/ai-chat-history.jsonl`。
- V1 只计划一个 JavaScript 应用，不引入 Nx、Turborepo 或 npm
  workspaces；出现第二个独立 package 后再评估。

## 当前交付状态

| 要求 | 状态 |
| --- | --- |
| 单一代码仓库 | 已满足 |
| `README.md` 与 `docs/prd.md` | 已满足 |
| AI 开发对话 `.jsonl` | 已满足，交付前仍需刷新 |
| 测试与 E2E 设计 | 已定义，自动化尚未实现 |
| Expo + TypeScript 应用源码 | 未开始 |
| Android/iOS 真机运行 | 有运行方案，尚未构建验证 |

## 原型预览

直接用浏览器打开 `prototype/index.html`。原型使用内存 mock 数据，只验证信息架构和交互，不代表后端已完成。
