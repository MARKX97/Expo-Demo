# 电梯故障派工与交接 App

面向电梯区域主管与电梯工程师的移动端派工工具。主管创建并指派故障工单，工程师接单、
处理并关闭工单。应用使用 Expo + TypeScript 构建 Android/iOS 客户端，Supabase 提供
认证、数据库、权限控制和现场照片存储。

## 产品范围

- 主管：登录、查看全部工单、创建并指派工单、改派尚未开始的工单。
- 工程师：登录、查看分配给自己的工单、开始处理、填写处理结果并关闭。
- 工单状态：`assigned -> in_progress -> closed`，关闭后只读。
- 工单包含区域、梯号/设备编号、描述、优先级、接手工程师和 1–3 张现场照片。
- 账号由管理员预创建，不开放注册；用户可通过邮件重设密码。
- 紧急工单只做置顶和标识，不替代既有线下应急救援机制。

## 技术栈

| 区域 | 技术 |
| --- | --- |
| 移动端 | Expo、React Native、Expo Router、TypeScript |
| 后端 | Supabase Auth、Postgres、PostgREST、RPC、Storage |
| 单元与组件测试 | Jest、React Native Testing Library |
| 数据库测试 | Supabase CLI、pgTAP |
| E2E | Maestro、EAS Workflows |
| 构建与分发 | EAS development / preview build |

本项目不使用 Expo Go，也不维护手写的 `android/` 或 `ios/` 目录。原生项目由 Expo
Continuous Native Generation 在构建时生成。

## 环境要求

- Git
- Node.js 22.13 LTS 或更高版本与 pnpm
- Docker 与 Supabase CLI（仅完整本地数据库/集成验证需要）
- Expo 账号
- Supabase 项目
- Android 真机，或具备签名条件的 iPhone/iPad
- iOS EAS Ad Hoc 安装需要付费 Apple Developer Program 账号

## 快速开始

```bash
git clone git@github.com:MARKX97/Expo-Demo.git
cd Expo-Demo
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

编辑 `.env.local`：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`EXPO_PUBLIC_*` 会进入客户端包，只能填写 Supabase URL 与 publishable key。禁止把
`service_role` key、密码或真实用户数据写入客户端环境变量或提交到 Git。

首次在设备上开发，需要先生成并安装 development build：

```bash
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build --platform android --profile development
# 或
pnpm dlx eas-cli@latest build --platform ios --profile development
```

安装完成后启动 Metro：

```bash
pnpm run start
```

development build、Android APK、iOS Ad Hoc IPA、模拟器和签名限制的完整步骤见
[Android / iOS 运行手册](docs/RUNBOOK.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm run start` | 启动 Expo development client 的 Metro |
| `pnpm run lint` | 检查代码规范 |
| `pnpm run typecheck` | 检查 TypeScript 类型 |
| `pnpm test` | 运行前端单元、组件与路由测试 |
| `pnpm run verify:fast` | 运行提交时由 Husky 自动执行的快速门禁 |
| `pnpm run verify` | 运行提交前的本地质量门禁 |
| `pnpm exec expo-doctor` | 检查 Expo 配置与依赖兼容性 |
| `supabase start` | 启动本地 Supabase |
| `supabase db reset` | 从 migration 与 seed 重建本地数据库 |
| `supabase test db` | 运行 pgTAP 数据库测试 |

## Supabase 准备

1. 创建 Supabase 项目。
2. 按 `supabase/migrations/` 应用数据库结构、RPC、RLS 与私有 Storage bucket。
3. 在 Supabase Dashboard 预创建主管和工程师 Auth 用户。
4. 为每个 Auth 用户创建对应 `profiles` 记录并设置角色。
5. 在 Auth Redirect URLs 中允许
   `elevatorhandoff://reset-password`。
6. 将 Supabase URL 与 publishable key 写入本地和 EAS 对应环境。

数据库表、关系、角色权限与初始化规则以
[后端与数据库设计](docs/BACKEND.md)为准。

## 仓库结构

```text
.
├── app/                    # Expo Router 页面与路由布局
├── src/
│   ├── components/        # 可复用业务 UI
│   ├── lib/               # Supabase 初始化与通用错误映射
│   ├── services/          # Auth、profile、工单业务接口
│   └── types/             # 业务类型与生成的数据库类型
├── supabase/
│   ├── migrations/        # 数据库 schema 事实源
│   └── tests/             # pgTAP 数据库测试
├── __tests__/             # 单元、组件与路由测试
├── tests/                 # Supabase 集成测试与固定数据
├── .maestro/              # Android/iOS E2E flows
├── .eas/workflows/        # EAS 自动化工作流
├── design-system/         # UI 与可访问性规范
├── docs/                  # 产品、技术、运行和测试文档
└── prototype/             # 纯 HTML 交互原型
```

页面不得直接拼装 Supabase 查询。读取、Auth、RPC 与 Storage 操作统一封装在
`src/services/`；数据库状态变更只通过受控 RPC 完成。

## 测试

提交前运行：

```bash
pnpm run verify
```

涉及数据库或权限时，额外运行：

```bash
supabase start
supabase db reset
supabase test db
eval "$(supabase status -o env \
  --override-name api.url=TEST_SUPABASE_URL \
  --override-name auth.anon_key=TEST_SUPABASE_PUBLISHABLE_KEY \
  --override-name auth.service_role_key=TEST_SUPABASE_SECRET_KEY)"
pnpm run test:integration
```

涉及用户主流程、路由、照片或原生配置时，按
[测试与质量策略](docs/TESTING.md)运行 Maestro，并完成 Android/iOS 真机验收。

## 构建

Android 内部演示 APK：

```bash
pnpm dlx eas-cli@latest build --platform android --profile preview
```

iOS 内部演示 IPA：

```bash
pnpm dlx eas-cli@latest build --platform ios --profile preview
```

Preview 包可脱离 Metro 运行，但仍需要网络访问 Supabase。iOS 安装受 Apple 签名和已登记
设备限制。

## 文档

- [仓库知识索引](docs/README.md)
- [产品需求](docs/prd.md)
- [总体架构](ARCHITECTURE.md)
- [前端技术设计](docs/FRONTEND.md)
- [后端与数据库设计](docs/BACKEND.md)
- [前后端对接契约](docs/API_CONTRACT.md)
- [Android / iOS 运行手册](docs/RUNBOOK.md)
- [测试与质量策略](docs/TESTING.md)
- [Harness Engineering 开发护栏](docs/HARNESS.md)
- [设计系统](design-system/电梯故障派工/MASTER.md)
- [AI 开发对话记录](docs/ai-chat-history.jsonl)

Codex 读取 [AGENTS.md](AGENTS.md)，Claude Code 通过
[CLAUDE.md](CLAUDE.md)导入同一份规则。修改产品或技术行为时，先更新对应事实源文档，再
实现代码与测试。

## 原型

浏览器直接打开 `prototype/index.html` 可查看纯 HTML 交互原型。原型只用于验证信息架构
与交互，不作为真实后端或移动端实现。

## 官方参考

- [Create a project with create-expo-app](https://docs.expo.dev/more/create-expo/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native)
