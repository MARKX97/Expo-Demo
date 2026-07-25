# Android / iOS 运行手册

版本：0.3

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

1. 安装 Git、项目约定的 Node.js LTS 与 npm。
2. 注册并登录 [Expo](https://expo.dev/) 账号。
3. 创建 Supabase 项目并准备：
   - Project URL
   - publishable key
4. 克隆仓库并安装依赖：

```bash
git clone git@github.com:MARKX97/Expo-Demo.git
cd Expo-Demo
npm install
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

首个 Expo scaffold 必须安装 development client：

```bash
npx expo install expo-dev-client
```

安装前后端对接所需的最小客户端依赖：

```bash
npx expo install @supabase/supabase-js \
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
      "bundleIdentifier": "com.markx97.elevatorhandoff"
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

云端构建时，在 Expo 项目的 EAS Environment Variables 中分别为 `development` 与 `preview` 配置相同变量。不要把真实值写进 `eas.json`。

## 4. EAS build profiles

实现阶段在根目录创建以下 `eas.json`：

```json
{
  "cli": {
    "version": ">= 16.0.0"
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
    }
  }
}
```

- `development` 包含开发客户端，安装后仍需连接 Metro。
- `preview` 是可独立运行的内部演示包，不需要启动 Metro。
- Android `preview.android.buildType = apk` 保证得到可直接安装的 APK，而不是只能通过 Play Store 分发的 AAB。

## 5. Android 真机

### 5.1 Development build

```bash
npx eas-cli@latest build --platform android --profile development
```

首次构建按提示让 EAS 生成并托管 Android keystore。构建完成后：

1. 在 EAS build 页面点击 Install，或用 Android 手机扫描二维码。
2. 浏览器下载 APK。
3. 按 Android 提示允许该浏览器“安装未知应用”，完成安装。
4. 在电脑项目目录启动 Metro：

```bash
npx expo start --dev-client
```

5. 手机与电脑同一局域网时，从 development client 连接该开发服务器。
6. 局域网发现失败时改用：

```bash
npx expo start --dev-client --tunnel
```

JS/TS 修改可热更新；新增原生依赖、修改 plugin 或原生权限后必须重新执行 EAS development build。

### 5.2 Preview APK

```bash
npx eas-cli@latest build --platform android --profile preview
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
npx eas-cli@latest device:create
```

命令会给出注册链接。用目标 iPhone 打开链接，按页面提示安装临时描述文件并完成设备登记。每新增一台设备，都要重新构建或刷新 Ad Hoc provisioning profile，旧 IPA 不会自动支持新设备。

### 6.3 Development build

```bash
npx eas-cli@latest build --platform ios --profile development
```

首次构建：

1. 登录 Apple Developer 账号。
2. 允许 EAS 创建或复用 Distribution Certificate。
3. 选择已登记的测试设备。
4. 构建完成后，在目标 iPhone 上打开 EAS build 页面并点击 Install，或扫描安装二维码。
5. 安装后启动 Metro：

```bash
npx expo start --dev-client
```

6. 打开主屏幕中的 App，连接当前开发服务器。

### 6.4 Preview IPA

```bash
npx eas-cli@latest build --platform ios --profile preview
```

Preview 包无需 Metro，但只能安装到构建时已写入 Ad Hoc provisioning profile 的设备。新增设备后必须重新构建。

### 6.5 没有付费 Apple Developer 账号

不能用 EAS Ad Hoc 把 IPA 安装到真实 iPhone。可用的开发路径是：

1. 使用 macOS 安装 Xcode。
2. USB 连接 iPhone，开启 Developer Mode，并在 Xcode 登录个人 Apple ID。
3. 在项目中运行：

```bash
npx expo run:ios --device
```

该路径使用本地 Xcode 签名，不满足“完全无需 iOS 开发环境”，且免费签名有效期和能力受 Apple 限制。若只要求完成作业演示，优先使用 Android APK 可减少账号与签名风险。

## 7. iOS Simulator

macOS + Xcode 可直接运行：

```bash
npx expo run:ios
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
npx eas-cli@latest build --platform ios --profile ios-simulator
```

Simulator build 不能安装到真实 iPhone。

## 8. 构建前检查

每次 EAS 构建前执行：

```bash
npm ci
npm run verify
npx expo-doctor
```

测试构建 profile、Maestro flows 和 EAS Workflows 以
[TESTING.md](TESTING.md) 为唯一事实源；本文件只定义开发和交付构建。

检查以下内容：

- Git 工作区没有误提交 `.env*` 或密钥。
- `app.json` 中 package、bundle identifier 与 scheme 固定。
- `expo-image-picker` plugin 保留明确的 iOS 相册用途文案；修改后重新构建 development
  client。
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
