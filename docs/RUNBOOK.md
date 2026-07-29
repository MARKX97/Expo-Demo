# Android / iOS 运行手册

版本：0.4

日期：2026-07-25

适用阶段：PoC / MVP 内部测试

## 1. 交付结论

本项目不使用 Expo Go，也不要求上架 App Store 或 Google Play。

| 目标 | 推荐方式 | 产物 | 是否需要本地原生环境 |
| --- | --- | --- | --- |
| Android 真机开发 | EAS development build | APK | 否 |
| Android 真机演示 | EAS preview build | APK | 否 |
| iOS 真机开发 | EAS development build + Ad Hoc | IPA | 否，但需要付费 Apple Developer |
| iOS 真机演示 | EAS preview build + Ad Hoc | IPA | 否，但需要付费 Apple Developer |
| iOS 真机且无付费账号 | macOS + Xcode 本地签名 | 本机安装 | 是 |
| iOS Simulator | 本地 Xcode 或 EAS simulator build | Simulator app | 本地运行 Simulator 需要 macOS |

Android APK 可直接安装。iOS 真机 IPA 必须签名；EAS Ad Hoc 方式要求付费 Apple Developer 账号，并把每台测试设备的 UDID 加入 provisioning profile。这是 Apple 平台限制，不是 Expo 配置可以绕过的限制。

官方参考：

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android EAS development build](https://docs.expo.dev/tutorial/eas/android-development-build/)
- [iOS EAS development build](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [EAS internal distribution](https://docs.expo.dev/build/internal-distribution/)

## 2. 一次性准备

### 通用

1. 安装 Git、项目约定的 Node.js LTS 与 pnpm。
2. 注册并登录 [Expo](https://expo.dev/) 账号。
3. 创建 Supabase 项目并准备：
   - Project URL
   - publishable key
   - Auth 关闭自助注册
   - Auth Redirect URLs 包含 `elevatorhandoff://reset-password`
4. 克隆仓库并安装依赖：

```bash
git clone git@github.com:MARKX97/Expo-Demo.git
cd Expo-Demo
corepack enable
pnpm install --frozen-lockfile
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build:configure
```

首个 Expo scaffold 必须安装 development client：

```bash
pnpm exec expo install expo-dev-client
```

安装前后端对接所需的最小客户端依赖：

```bash
pnpm exec expo install @supabase/supabase-js \
  @react-native-async-storage/async-storage \
  react-native-url-polyfill \
  expo-image-picker \
  expo-image-manipulator
```

- `supabase-js`：Auth、PostgREST、RPC 和 Storage 客户端。
- `AsyncStorage`：React Native session 持久化。
- `react-native-url-polyfill`：密码重置 deep link 与 Supabase URL 处理。
- `expo-image-picker`：从 Android/iOS 相册选择现场照片。
- `expo-image-manipulator`：把 HEIC/AVIF 等双端来源统一为受支持的 JPEG。

认证初始化和 deep link 调用顺序见
[前后端对接契约](API_CONTRACT.md#6-auth-接口)；不额外引入 API client 或状态管理库。

### 应用标识

首版默认使用：

```json
{
  "expo": {
    "scheme": "elevatorhandoff",
    "plugins": [
      "expo-router",
      [
        "expo-image-picker",
        {
          "photosPermission": "允许梯维派工选择现场照片，用于创建电梯故障工单。",
          "microphonePermission": false
        }
      ]
    ],
    "android": {
      "package": "com.markx97.elevatorhandoff"
    },
    "ios": {
      "bundleIdentifier": "com.markx97.elevatorhandoff",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    }
  }
}
```

如果标识在 Apple/Google 侧不可用，必须在第一次签名构建前修改；产生正式签名后不要随意更换。

## 3. 环境变量

本地创建 `.env.local`，不得提交：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`EXPO_PUBLIC_*` 会进入客户端包，因此只能放客户端可公开的 Supabase URL 与 publishable
key。`service_role` key 永远不能放入 App、EAS 客户端环境变量或 Git。

云端构建时，在 Expo 项目的 EAS Environment Variables 中分别为 `development` 与
`preview` 配置相同变量。`e2e-test` 复用 `preview` 环境。不要把真实值写进 `eas.json`。

运行 EAS Maestro 前，在 `production` 环境配置
`docs/TESTING.md` 第 8.1 节列出的 `MAESTRO_*` 虚构测试账号变量，以及：

```dotenv
E2E_ALLOW_TEST_RESET=true
E2E_SUPABASE_URL=https://YOUR_E2E_PROJECT_REF.supabase.co
E2E_PROJECT_REF=YOUR_E2E_PROJECT_REF
E2E_SUPABASE_SECRET_KEY=YOUR_E2E_SECRET_KEY
```

`E2E_SUPABASE_SECRET_KEY` 必须使用 EAS Secret 可见性，账号密码使用 Sensitive/Secret；
任何变量都不得使用 `EXPO_PUBLIC_*` 前缀。当前没有 build profile 读取 `production`
环境，它在本 PoC 中只隔离 Maestro hook 管理变量；`e2e-test` 构建仍只读取 `preview`
中的 `EXPO_PUBLIC_SUPABASE_*`。未来新增 production build 前，必须先把 E2E 管理变量
迁出该环境，避免管理员密钥进入 build job。

### 3.1 初始化托管 Supabase

首次使用空项目时，在配置 EAS 变量后执行：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase config push
```

`db push` 只应用仓库 migration；`config push` 同步关闭注册、密码长度与重置深链等 Auth
配置。执行前必须先审阅 dry run 和配置 diff，不能用 Dashboard 手工建表替代 migration。

## 4. EAS build profiles

实现阶段在根目录创建以下 `eas.json`：

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development"
    },
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "android": {
        "buildType": "apk"
      }
    },
    "e2e-test": {
      "withoutCredentials": true,
      "environment": "preview",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    }
  }
}
```

- `development` 包含开发客户端，安装后仍需连接 Metro。
- `preview` 是可独立运行的内部演示包，不需要启动 Metro。
- Android `preview.android.buildType = apk` 保证得到可直接安装的 APK，而不是只能通过 Play Store 分发的 AAB。
- `e2e-test` 生成 Android APK 与 iOS Simulator `.app`，仅供自动化；iOS 产物不能安装到
  真机，且尚未等同于交付验收。

## 5. Android 真机

### 5.1 Development build

```bash
pnpm dlx eas-cli@latest build --platform android --profile development
```

首次构建按提示让 EAS 生成并托管 Android keystore。构建完成后：

1. 在 EAS build 页面点击 Install，或用 Android 手机扫描二维码。
2. 浏览器下载 APK。
3. 按 Android 提示允许该浏览器“安装未知应用”，完成安装。
4. 在电脑项目目录启动 Metro：

```bash
pnpm exec expo start --dev-client
```

5. 手机与电脑同一局域网时，从 development client 连接该开发服务器。
6. 局域网发现失败时改用：

```bash
pnpm exec expo start --dev-client --tunnel
```

JS/TS 修改可热更新；新增原生依赖、修改 plugin 或原生权限后必须重新执行 EAS development build。

### 5.2 Preview APK

```bash
pnpm dlx eas-cli@latest build --platform android --profile preview
```

把 EAS 生成的安装链接或二维码发给测试者。Preview 包独立运行，不依赖电脑和 Metro；仍需要网络访问 Supabase。

### 5.3 Android 常见问题

- 下载的是 `.aab`：确认使用 `preview` profile 且 `buildType` 为 `apk`。
- 安装被阻止：在系统设置中仅对当前下载来源临时允许“安装未知应用”。
- App 连不上 Metro：确认同一网络、防火墙未拦截，或使用 `--tunnel`。
- Supabase 请求失败：核对 EAS 环境变量和项目 URL，不要把 `service_role` key 放入客户端。

## 6. iOS 真机：EAS 推荐路径

### 6.1 前置条件

- 付费 Apple Developer Program 账号。
- iPhone/iPad 开启 Developer Mode（iOS 16+）。
- 设备 UDID 已注册到 EAS/Apple provisioning profile。

### 6.2 注册测试设备

```bash
pnpm dlx eas-cli@latest device:create
```

命令会给出注册链接。用目标 iPhone 打开链接，按页面提示安装临时描述文件并完成设备登记。每新增一台设备，都要重新构建或刷新 Ad Hoc provisioning profile，旧 IPA 不会自动支持新设备。

### 6.3 Development build

```bash
pnpm dlx eas-cli@latest build --platform ios --profile development
```

首次构建：

1. 登录 Apple Developer 账号。
2. 允许 EAS 创建或复用 Distribution Certificate。
3. 选择已登记的测试设备。
4. 构建完成后，在目标 iPhone 上打开 EAS build 页面并点击 Install，或扫描安装二维码。
5. 安装后启动 Metro：

```bash
pnpm exec expo start --dev-client
```

6. 打开主屏幕中的 App，连接当前开发服务器。

### 6.4 Preview IPA

```bash
pnpm dlx eas-cli@latest build --platform ios --profile preview
```

Preview 包无需 Metro，但只能安装到构建时已写入 Ad Hoc provisioning profile 的设备。新增设备后必须重新构建。

### 6.5 没有付费 Apple Developer 账号

不能用 EAS Ad Hoc 把 IPA 安装到真实 iPhone。可用的开发路径是：

1. 使用 macOS 安装 Xcode。
2. USB 连接 iPhone，开启 Developer Mode，并在 Xcode 登录个人 Apple ID。
3. 在项目中运行：

```bash
pnpm exec expo run:ios --device
```

该路径使用本地 Xcode 签名，不满足“完全无需 iOS 开发环境”，且免费签名有效期和能力受 Apple 限制。若只要求完成作业演示，优先使用 Android APK 可减少账号与签名风险。

## 7. iOS Simulator

macOS + Xcode 可直接运行：

```bash
pnpm exec expo run:ios
```

也可增加专用 EAS profile：

```json
{
  "build": {
    "ios-simulator": {
      "developmentClient": true,
      "ios": {
        "simulator": true
      }
    }
  }
}
```

```bash
pnpm dlx eas-cli@latest build --platform ios --profile ios-simulator
```

Simulator build 不能安装到真实 iPhone。

## 8. 构建前检查

每次 EAS 构建前执行：

```bash
pnpm install --frozen-lockfile
pnpm run verify
pnpm exec expo-doctor
```

测试构建 profile、Maestro flows 和 EAS Workflows 以
[TESTING.md](TESTING.md) 为唯一事实源；本文件只定义开发和交付构建。

检查以下内容：

- Git 工作区没有误提交 `.env*` 或密钥。
- `app.json` 中 package、bundle identifier 与 scheme 固定。
- `expo-image-picker` plugin 保留明确的 iOS 相册用途文案；修改后重新构建 development
  client。
- iOS 26 的 `react-native-screens` Fabric 快照路径由精确版本 `4.26.2` 加
  `patches/react-native-screens@4.26.2.patch` 临时规避；patch 只在 iOS 26 卸载 Screen Stack 时跳过快照。
  当前源码已在本地 Xcode Release Simulator 原生产物完成启动验证，但尚未以该新原生产物复跑完整关键流。每次 EAS iOS 构建必须从 lockfile 安装该版本和 patch；构建后先验证
  “登录 → 新建工单”不退出，再运行完整 `critical-journey.yml`，不得只以启动或登录 smoke 作为业务闭环证据。
- Supabase migration 已应用，测试账号与角色存在。
- Supabase Auth Redirect URLs 已允许 `elevatorhandoff://reset-password`，PKCE 重置邮件在
  发起请求的同一测试设备打开。
- development/preview 对应 EAS 环境变量已配置。
- 新增原生依赖后已重新生成 development build。

## 9. PoC 验收路径

1. Android 至少安装一份 Preview APK，脱离电脑可启动。
2. iOS 使用 EAS Ad Hoc IPA，或明确记录采用 macOS + Xcode 本地签名。
3. 主管账号登录并创建含照片工单。
4. 工程师账号在另一设备刷新、开始处理并关闭。
5. 忘记密码链接能通过 `elevatorhandoff://reset-password` 返回 App。
6. 未授权账号和越权操作被 Supabase 拒绝。

## 10. P2 E2E 执行

首次运行前关联 EAS 项目与 GitHub 仓库，并按第 3 节分别配置 `preview` 构建变量和
`production` Maestro 管理变量：

```bash
pnpm dlx eas-cli@latest init
pnpm dlx eas-cli@latest workflow:validate .eas/workflows/e2e-test-android.yml
pnpm dlx eas-cli@latest workflow:validate .eas/workflows/e2e-test-ios.yml
```

本地已有对应 APK / iOS Simulator `.app` 和模拟器时，可用 Maestro CLI：

```bash
node scripts/run-maestro.mjs .maestro/flows/smoke-login.yml
node scripts/run-maestro.mjs .maestro/flows/critical-journey.yml
node scripts/run-maestro.mjs .maestro/flows/expired-reset-link.yml
```

### 10.1 本次 iOS Simulator 排障与工具记录（2026-07-29）

本次在 iOS 26.5 Simulator 使用现有 `e2e-test` 原生壳、导出的当前 Hermes bundle 和
Maestro CLI 2.7.0 验证；`smoke-login.yml`、`expired-reset-link.yml` 与
`critical-journey.yml` 均通过。2026-07-30 又以当前源码构建的 Release 原生产物复跑三条
Flow 均通过；这不替代 Android、真机、真实邮件重置或跨设备 UAT。

| 问题 | 根因与处理 |
| --- | --- |
| 本地 `eas build --local` 无法开始 | 环境没有 Fastlane。Gem 与 Homebrew 安装均未成功，因此没有为排障额外加入 Fastlane；改用匹配的现有 Simulator 原生壳做源码回归。需要全新原生产物时，先确认 `fastlane --version`，再完成安装。 |
| iOS 登录后业务页被遮挡 | 系统“保存密码”弹窗覆盖页面。共享登录 Flow 用条件分支关闭弹窗后再断言页面。 |
| 多行输入后选择工程师或关闭工单无效 | iOS 软键盘覆盖控件。Flow 在描述和处理结果输入后显式 `hideKeyboard`。 |
| 失效重置链接一直显示验证中 | Expo Router 在冷启动时先消费 deep link。重置页从路由参数回退消费链接，并以超时收敛到可恢复的失效状态。 |
| 工单卡片找不到 | 无障碍名称是组合摘要，不等于单独梯号。Flow 改用包含梯号的正则选择器。 |

本次工具处理如下；“未安装”表示没有新增到机器或仓库，不能把尝试当作环境前置条件：

| 工具/下载 | 结果 | 后续做法 |
| --- | --- | --- |
| Maestro CLI 2.7.0 + Temurin JRE 17 | 已使用校验后的官方归档作为临时运行时，并通过三条 iOS Flow。 | 不写入仓库或项目依赖；未来在可信 macOS/CI runner 上复跑同一组 Flow。 |
| CocoaPods 1.17.0 + Homebrew Ruby 4.0.6 | 已安装并验证 `pod --version`；`expo-doctor` 随后 20/20 通过。 | 这是本机 iOS 原生工具检查所需环境，不是项目依赖。 |
| `pnpm dlx supabase@latest` / 项目 npm CLI | 当前 npm metadata 声明了不存在的 `darwin-arm64` 平台包；旧版下载二进制又被本机以退出码 137 终止。 | 不保留不可用依赖；使用经验证的官方 macOS ARM64 二进制，或在 CI 的 Supabase 环境运行 DB 测试。 |
| Supabase 官方 release 二进制 | 早期 51MB 下载在当前网络约 14KB/s 时中止；本轮确认现有官方 macOS ARM64 CLI 2.109.1 可运行项目只读管理操作。 | 本地 DB 测试仍要求本地 Supabase 服务成功启动；否则以 CI 作为正式 DB/集成证据。 |

### 10.2 新原生产物与本机 E2E 工具复验（2026-07-30）

- 使用 Xcode 26.6 在 iPhone 17 Pro / iOS 26.5 Simulator 构建当前源码的 `Release`
  原生产物，已完成安装与冷启动并进入主管工单总览。该结果只证明当前 native bundle 可以启动，
  不替代 `smoke-login.yml`、`expired-reset-link.yml` 和 `critical-journey.yml`。
- Supabase CLI 的 npm 启动器在本机 Node 20/Corepack 组合下会触发动态 import 错误；直接使用
  官方 macOS ARM64 CLI 2.109.1 已完成项目只读访问和 API key 类型校验。远端 CI 仍是
  DB/RLS/低权限集成与 Mailpit/PKCE 的正式证据。
- 已下载并 SHA-256 校验 Temurin JRE 17 与 Maestro CLI 2.7.0 官方归档，仅作为临时 Maestro
  运行环境，不写入仓库或项目依赖。当前 Release 原生产物已在 iPhone 17 Pro / iOS 26.5
  Simulator 通过三条 Flow；未来下载或运行环境变更后仍须以官方 checksum 校验并复跑。
- EAS `env:exec` 不会把 `Secret` 可见性的管理员密钥或测试账号密码下发到本机 shell。
  本机重跑时应由维护者在当前 shell 注入测试变量；不要为了本地便利将 EAS Secret 降级为
  Plain text，也不要把变量写入仓库。
- Maestro CLI 2.7 在本机对 `MAESTRO_*` shell 变量的 Flow 自动导入不稳定，会使 Flow 输入
  `undefined` 并被登录表单拒绝。保留 `MAESTRO_*` 作为密钥入口，统一通过
  `node scripts/run-maestro.mjs` 转为 CLI `-e` 参数；EAS `maestro` job 在 workflow 的 `env`
  显式映射成同名的非前缀 Flow 变量。禁止把密码值直接复制到命令行或 YAML。
| Fastlane（RubyGems / Homebrew） | 安装分别中断或网络失败，未安装。 | 仅在需要本地重新生成 iOS 原生构建时安装。 |
| `brew install supabase` | 会拉取 Node 运行时及其依赖，下载受网络阻塞后取消，未安装。 | 不以它作为本项目的默认 Supabase CLI 安装方式。 |

临时 Node 22/pnpm shim 和导出的 Hermes bundle 只用于本机验证，未写入仓库、未新增项目依赖。
本机没有 Supabase CLI 时，`pnpm run verify` 会在已通过文档、Expo Doctor、类型、lint 与单元测试后停在
`supabase test db`；低权限集成套件在未注入本地 Supabase/Mailpit 变量时会明确跳过。可先运行
`pnpm run verify:docs`、`pnpm run verify:fast`，并以 GitHub `verify` 的数据库门禁补齐证据。

账号通过 `MAESTRO_*` shell 变量注入；不要把 `-e PASSWORD=...` 命令复制到共享日志。
数据脚本会在任何网络请求前校验重置开关、HTTPS URL、project ref 与 secret key：

```bash
node scripts/e2e-test-data.mjs self-check
node scripts/e2e-test-data.mjs prepare
node scripts/e2e-test-data.mjs cleanup
```

`prepare` 先清理历史 `E2E-*` 工单，再确保 1 个主管和 2 个工程师账号/profile 可用；
`cleanup` 删除 Storage 对象、附件和工单，不删除账号。正常结束由
`after_maestro_tests` 清理；若云端作业中断，下一次 `prepare` 会先补偿清理。
EAS 运行：

```bash
pnpm dlx eas-cli@latest workflow:run .eas/workflows/e2e-test-android.yml
pnpm dlx eas-cli@latest workflow:run .eas/workflows/e2e-test-ios.yml
```

Android/iOS workflow 都使用手动 `workflow_dispatch`。包含管理员密钥的 Maestro hook
不得对不可信 Pull Request 自动运行；维护者确认分支可信后再触发。构建、Maestro 与双端
UAT 未真实执行前，
P2 状态只能标记为“配置已落盘，待外部验证”。证据填写
[测试与质量策略](TESTING.md#111-uat-与证据模板)。

若 Expo 账户不包含付费 Maestro job，先分别完成 `e2e-test` 构建，再从 GitHub Actions
手动运行 `Device E2E`，输入 Android APK 与 iOS Simulator 归档 URL。该 fallback 的
Secret、串行数据隔离与产物规则以 `TESTING.md` 第 8 节为准。
