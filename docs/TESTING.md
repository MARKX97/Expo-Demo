# 测试与质量策略

版本：0.2

最后审校：2026-07-25

## 1. 目标

建立从需求到交付证据的完整链路：

```mermaid
flowchart LR
    AC[PRD 验收 ID] --> UNIT[单元/组件]
    AC --> DB[数据库/RLS]
    AC --> INT[服务集成]
    AC --> E2E[Maestro E2E]
    E2E --> UAT[双端真机验收]
    UNIT --> GATE[CI 门禁]
    DB --> GATE
    INT --> GATE
    E2E --> GATE
    GATE --> EVIDENCE[报告/日志/截图/视频]
```

测试必须回答三件事：

1. 产品行为是否符合 PRD。
2. Supabase 权限是否在服务端真实生效。
3. Android/iOS 构建是否能由用户完成主流程。

## 2. 测试原则

- 测试用户可观察行为，不测试组件内部实现。
- 权限、状态机和数据完整性优先放在 Postgres constraint、RPC 和 RLS 测试。
- 页面测试 mock 业务 service，不 mock Supabase SDK 的内部调用链。
- 数据库和集成测试使用本地 Supabase；E2E 使用独立测试项目，禁止连接生产项目。
- 每个权限允许路径必须有对应拒绝路径。
- 失败必须留下 agent 可读取的日志、截图或视频，不能只给“测试失败”。
- 不以堆积快照或追求全局覆盖率替代关键分支测试。

## 3. 推荐技术栈

| 层级 | 工具 | 选择理由 |
| --- | --- | --- |
| TypeScript/静态检查 | `tsc`、Expo ESLint、`expo-doctor` | 最快发现类型、依赖和 Expo 配置问题 |
| 单元/组件/路由 | `jest-expo`、React Native Testing Library、`expo-router/testing-library` | Expo 官方路径，支持用户视角与内存路由测试 |
| 数据库 | Supabase CLI、pgTAP | 可验证 schema、constraint、RPC、RLS 和数据完整性 |
| 服务集成 | Jest + `@supabase/supabase-js` | 使用真实本地 Auth/Postgres/Storage 契约 |
| 移动端 E2E | Maestro + EAS Workflows | Android/iOS 共用流程，EAS 可直接构建并运行 |
| 最终验收 | Android/iOS 真机 | 验证安装、相册、深链和跨设备同步 |

Expo 官方推荐 `jest-expo` 与 React Native Testing Library，并提供
Expo Router 集成测试工具：

- [Expo 单元测试](https://docs.expo.dev/develop/unit-testing/)
- [Expo Router 测试](https://docs.expo.dev/router/reference/testing/)

E2E 采用 [Expo EAS Workflows + Maestro](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)。
不选 Detox：本项目只需要 PoC 主流程，Detox 会增加本地原生工具链和维护成本。

数据库测试遵循
[Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview)：
pgTAP 覆盖结构、RLS、函数和数据完整性，并在事务中隔离测试数据。

## 4. 测试目录

首个 Expo scaffold 创建以下实际需要的目录：

```text
.
├── __tests__/
│   ├── unit/
│   ├── components/
│   └── router/
├── tests/
│   ├── integration/
│   └── fixtures/
│       └── work-order-photo.jpg
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
│       └── database/
├── .maestro/
│   ├── flows/
│   └── shared/
└── .eas/
    └── workflows/
```

Expo Router 的测试文件不能放进 `app/`，否则会被当成路由。

## 5. 环境与数据隔离

### 5.1 本地数据库与集成测试

使用 Supabase CLI：

```bash
supabase start
supabase db reset
supabase test db
```

`supabase db reset` 必须从空库重放全部 migration 和 seed。测试至少准备：

| 身份 | 作用 |
| --- | --- |
| 匿名用户 | 验证全部业务数据拒绝 |
| 主管 A | 创建、查看全部、改派 |
| 工程师 A | 处理自己的工单 |
| 工程师 B | 验证跨工程师隔离 |
| 停用工程师 | 验证不能被新工单选择 |

pgTAP 可以在事务内准备 Auth 关联行；需要真实邮箱密码登录的集成测试账号由 suite setup 使用本地 Admin API 创建。数据库测试使用 `begin`/`rollback` 隔离。集成测试使用唯一
`run_id` 命名工单和 Storage 路径，并在 suite 结束清理。

### 5.2 E2E 测试项目

EAS 云端设备不能访问开发机的本地 Supabase，因此使用独立、可清理的 Supabase 测试项目：

- 只存虚构账号和图片，不存真实业务数据。
- App 只接收 publishable key。
- CI 准备数据时可在服务端使用 secret key，但不得写入 App bundle、日志或 artifact。
- 每次运行使用唯一 `run_id`，运行结束删除对应用户、工单和 Storage 对象。
- 禁止对生产项目执行 `db reset`、seed 或 E2E 清理。

密码重置分两层验证：

1. 本地 Supabase + Mailpit 验证邮件生成、链接和 redirect。
2. 发布候选版本人工验证真实 SMTP 送达和 App 深链。

Supabase CLI 会用 Mailpit 捕获本地邮件，见
[Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords#local-development-with-mailpit)。

## 6. PRD 验收追踪

| 验收 ID | 自动测试 | 最终证据 |
| --- | --- | --- |
| `AC-AUTH-01` | Auth 集成 + 登录组件 + Maestro | 双角色登录视频 |
| `AC-AUTH-02` | Mailpit 集成 + 深链路由测试 | 真机密码重置记录 |
| `AC-WO-01` | 表单/上传集成 + RPC/constraint + Maestro | 含 1–3 张照片的工单 |
| `AC-WO-02` | RPC + 刷新集成 + Maestro | 工程师完成关闭流程 |
| `AC-PERM-01` | pgTAP/RPC + 主管 E2E | 仅 `assigned` 可改派 |
| `AC-PERM-02` | pgTAP + 低权限 JWT 集成 | 工程师 B 越权被拒绝 |
| `AC-FAIL-01` | 单元 + 集成 | 空结果、重复提交均无脏数据 |
| `AC-UPLOAD-01` | Storage 集成 | App 可补偿的失败/取消路径无残留对象 |
| `AC-CONCURRENCY-01` | RPC 集成 | 版本冲突后刷新云端状态 |
| `AC-DELIVERY-01` | EAS build + Maestro smoke | Android/iOS 可安装构建 |

新增或修改 PRD 验收项时，必须同时更新本表和对应自动测试。

## 7. 各层测试范围

### 7.1 文档与静态检查

- Markdown 格式和本地链接有效。
- `CLAUDE.md` 仍导入 `@AGENTS.md`。
- `API_CONTRACT.md` 中每个页面操作均有 Service、后端接口、错误和测试责任。
- TypeScript 无错误，lint 无错误。
- `expo-doctor` 通过。
- migration 后生成类型与提交版本一致。

### 7.2 单元测试

只测试有分支的纯逻辑：

- 工单字段 trim、长度、照片数量 1–3。
- 关闭结果必填。
- 状态对应的可见操作。
- Supabase/RPC 错误到用户文案的映射。
- 上传补偿计划和版本冲突处理。

状态机、权限和关键校验函数要求分支全覆盖。其他模块先记录覆盖率基线，后续不得无理由下降；不设置容易被无效测试刷高的全局数字。

### 7.3 组件与路由集成

- 登录 loading、错误、成功导航。
- 忘记密码和重置密码深链。
- 主管/工程师看到不同列表和操作。
- 新建表单禁用重复提交并正确报告上传失败。
- 关闭未填写结果时聚焦并宣读错误。
- 路由守卫阻止未登录和错误角色访问。
- 空态、刷新失败、重试和版本冲突。
- 44pt 触控、可访问名称、状态不只依赖颜色。

### 7.4 数据库与 RLS

pgTAP 覆盖：

- 表、枚举、外键、唯一约束、closed 一致性约束。
- `create_work_order`、`reassign_work_order`、`start_work_order`、
  `close_work_order` 的成功和拒绝路径。
- 匿名、主管、工程师 A、工程师 B、停用工程师。
- 所有表的直接非法写入。
- profile summary：主管可读历史接手人，工程师只可读自己和自己工单创建主管。
- 私有 bucket、对象路径、读写 policy。
- `expected_version` 冲突不会覆盖新数据。

### 7.5 服务集成

使用真实本地 Supabase URL 和低权限 JWT：

- 邮箱密码登录、错误密码、8 位最小密码、停用 profile。
- 冷启动和热启动密码重置 deep link、PKCE code 交换、跨设备/过期 code 失败。
- 活跃工程师列表。
- 1、2、3 张照片上传和工单创建。
- iOS HEIC/AVIF 与 Android 常见图片均归一化为受限尺寸的 JPEG。
- 第 2 张上传失败后的补偿清理。
- RPC 明确业务失败后清理已上传对象。
- RPC 已提交但响应丢失时，使用相同 ID 重放并返回原工单，不删除已落库附件。
- 补偿删除失败时保留草稿上下文并可再次清理。
- 重复点击只创建一张工单。
- 两个客户端并发更新返回版本冲突。
- 签名图片 URL 仅对有工单读取权的账号可用。

service key 只允许用于 suite setup/teardown，断言必须使用真实低权限客户端。

### 7.6 接口契约覆盖

| 接口组 | 必须覆盖 |
| --- | --- |
| `AUTH-01..07` | session 恢复、监听、登录、重置邮件、冷/热启动 recovery、更新密码、本机退出 |
| `QRY-01..03` | 自己的 profile、角色化分页列表、详情及不存在/无权限同结果 |
| `RPC-01..05` | 每个成功路径、角色拒绝、状态拒绝、停用账号和版本冲突 |
| `STO-01..03` | 类型/大小/路径、私有读取、上传补偿、已落库附件禁止删除 |

编号与请求/响应以 [API_CONTRACT.md](API_CONTRACT.md) 为准。接口新增、删除或改名时，
同一变更必须更新本表和对应测试。

## 8. Maestro E2E

### 8.1 稳定性约束

- 关键控件提供稳定 `testID` 和可访问名称。
- 优先使用 ID 或确定文本，不使用坐标点击。
- 每条 flow 从 `clearState: true` 和确定 seed 开始。
- 禁止固定 `sleep`；等待明确的可见状态。
- 使用 Maestro `addMedia` 把
  `tests/fixtures/work-order-photo.jpg` 放入设备相册。
- 系统相册选择器按 Android/iOS 拆分共享 subflow。
- 失败保留截图、视频和 Maestro 日志。

Maestro 的 [`addMedia`](https://docs.maestro.dev/reference/commands-available/addmedia)
支持将工作区图片加入 Android/iOS 设备相册。

### 8.2 Flow 清单

| Flow | 关键步骤 |
| --- | --- |
| `smoke-login` | 启动 → 主管登录 → 工单列表 |
| `supervisor-create` | 登录 → 选择 1 张测试照片 → 创建并指派 |
| `supervisor-reassign` | 改派 `assigned` 成功；处理中不出现改派 |
| `engineer-process` | 工程师 A 登录 → 刷新 → 开始 → 填结果 → 关闭 |
| `engineer-isolation` | 工程师 B 登录 → 搜索不到 A 的工单 |
| `validation-errors` | 0/4 张照片、空处理结果、重复提交 |
| `password-reset-route` | 冷/热启动打开 reset deep link → 建立 recovery session → 更新密码 |

自动 E2E 可以用顺序切换账号证明跨 session 同步，但不能证明真实跨设备。最终交付仍必须由两台设备或一台设备加一台模拟器执行 UAT。

### 8.3 EAS 测试构建

`eas.json` 增加独立 profile，不复用 development/preview：

```json
{
  "build": {
    "e2e-test": {
      "withoutCredentials": true,
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Android PR workflow：

```yaml
name: e2e-test-android
on:
  pull_request:
    branches: ['*']
jobs:
  build_android_for_e2e:
    type: build
    params:
      platform: android
      profile: e2e-test
  maestro_test:
    needs: [build_android_for_e2e]
    type: maestro
    params:
      build_id: ${{ needs.build_android_for_e2e.outputs.build_id }}
      flow_path:
        - .maestro/flows/smoke-login.yml
        - .maestro/flows/supervisor-create.yml
        - .maestro/flows/engineer-process.yml
```

iOS 发布候选 workflow：

```yaml
name: e2e-test-ios
on:
  workflow_dispatch:
jobs:
  build_ios_for_e2e:
    type: build
    params:
      platform: ios
      profile: e2e-test
  maestro_test:
    needs: [build_ios_for_e2e]
    type: maestro
    params:
      build_id: ${{ needs.build_ios_for_e2e.outputs.build_id }}
      flow_path:
        - .maestro/flows/smoke-login.yml
        - .maestro/flows/supervisor-create.yml
        - .maestro/flows/engineer-process.yml
```

实际实现时以当前 EAS Workflows schema 校验结果为准。手动运行：

```bash
eas workflow:validate .eas/workflows/e2e-test-android.yml
eas workflow:validate .eas/workflows/e2e-test-ios.yml
eas workflow:run .eas/workflows/e2e-test-android.yml
eas workflow:run .eas/workflows/e2e-test-ios.yml
```

EAS 的 Maestro job 当前仍标记为 alpha。若出现平台级不稳定，保留同一套 `.maestro` flows 和 `e2e-test` 构建，在具备模拟器的 CI runner 上执行 `maestro test`；不得因此删除 E2E 或降低断言。

## 9. CI 与质量门禁

| 时机 | 必须通过 | 是否阻塞 |
| --- | --- | --- |
| 每个 PR | 文档、typecheck、lint、单元/组件、DB、集成 | 是 |
| App/后端 PR | Android Maestro 主流程 | 是 |
| 合入 `main` 或每日 | Android 完整 Maestro | 是 |
| 发布候选 | Android + iOS 完整 Maestro、EAS build | 是 |
| 最终交付 | 双角色跨设备 UAT、密码重置、安装验证 | 是 |

文档-only PR 不触发付费 EAS 构建；仍必须运行文档检查。

测试失败只允许因明确的外部基础设施故障重跑一次。第二次失败即阻塞；不允许通过提高重试次数隐藏 flake。重复 flake 必须形成缺陷并修复选择器、数据隔离或等待条件。

OpenAI Harness Engineering 提到高吞吐团队可以弱化部分阻塞门禁，但这依赖成熟的自动修复和可观测系统。本 PoC 涉及 RLS 和真实认证，不复制该策略，安全与主流程测试保持阻塞。

## 10. 命令契约

首个 Expo scaffold 必须提供：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "expo lint",
    "test": "jest",
    "test:unit": "jest __tests__",
    "test:integration": "jest tests/integration --runInBand",
    "test:db": "supabase test db",
    "verify:docs": "node scripts/verify-docs.mjs",
    "verify:fast": "npm run typecheck && npm run lint && npm run test:unit",
    "verify": "npm run verify:docs && npx expo-doctor && npm run verify:fast && npm run test:db && npm run test:integration"
  }
}
```

`verify-docs.mjs` 只检查必需文档及本地链接、`CLAUDE.md` 导入和
`API_CONTRACT.md` 接口编号。AI 对话 JSONL 是记录文件，不由该脚本读取或作为门禁。

E2E 不塞进本地 `verify`，因为它需要构建产物和云端设备；由 `.eas/workflows/` 独立门禁。

## 11. 发布候选验收

每个平台保留以下证据：

- commit SHA、EAS build ID、应用版本和测试环境。
- Maestro 结果、失败截图和主流程视频。
- 主管与工程师测试账号标识，不记录密码。
- 创建的工单 ID、照片数量和最终状态。
- 密码重置邮件时间、redirect 结果。
- Android/iOS 安装与启动结果。

通过条件：

1. 所有 PRD 验收 ID 有通过证据。
2. 无 P0/P1 缺陷，无已知 RLS 绕过。
3. Android 和 iOS 构建均可安装并启动。
4. 至少一次双角色跨设备流程完成。

## 12. 当前缺口

当前仅建立测试设计与目录/命令骨架，以下尚未实现：

- 文档验证脚本、Jest/RNTL 测试代码与可通过的完整 `verify` 链路。
- Supabase migration、seed、pgTAP 与本地集成环境。
- Maestro flows、EAS E2E profile 与 workflows。
- CI、artifact 保存和双端真机验收。

在这些项目完成前，不能把仓库状态标记为“已验证”。
