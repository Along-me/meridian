# Meridian 时区助手

Windows 桌面时钟与日常转换工具。

macOS 未签名测试版单独提供 Apple 芯片和 Intel 下载，安装与限制见 [Mac 测试说明](docs/mac-testing.md)。

- 多时区桌面挂件：多种样式、别称、独立配色、透明度、置顶和位置锁定。
- 日期时间、时间戳双向转换，时间对照表及自定义场景时间对照。
- 货币转换：可切换汇率源、手动导入、最近 10 天缓存与固定参考汇率兜底。
- 开机启动、托盘召回、独立工具快捷键及 GitHub 更新检测。

## 安装

在 [Releases](https://github.com/Along-me/meridian/releases/latest) 下载 `Meridian-Setup-版本号-x64.exe`，适用于 Windows 10/11 x64。升级会保留已有设置。

1.2.0 是首个带更新检测的版本。此前版本请手动安装一次；之后默认在启动时检查，也可在“助手设置 → 版本与更新”手动检查。下载和退出安装都需要用户点击，不会静默安装。

汇率用于参考，界面会显示来源和实际汇率日期。无网络及缓存时使用随包的历史参考值，不将其标记为当天汇率。

## 本地开发

使用 Node.js 24 和 npm。在项目目录运行：

```powershell
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/make-icons.ps1
npm start
```

日常调试使用 `npm start`，直接运行管理窗口和真实挂件，不需要打包。修改后退出托盘中的 Meridian，再运行一次。若已有安装版或测试包运行，先从托盘退出，避免单实例机制召回旧版。

`prototype.html` 是共享界面源码，`desktop/prepare.cjs` 在启动和构建前将它生成到 `desktop/app.html`；后者不直接编辑。日常不需要浏览器预览。首次安装默认值直接在 `build-presets.json` 修改；已有用户配置不受影响。原浏览器预览只保留为可选辅助入口。

验证：`npm test`、`npm run test:desktop`。桌面测试使用独立临时配置。用户运行配置、汇率凭据及缓存存放在本机用户目录，不提交到仓库。

## 构建输出

- `npm run pack`：免安装目录包，固定输出到 `release/local/win-unpacked/`。
- 双击该固定目录的 `Meridian.exe` 即可运行，无需安装。
- `npm run dist`：Windows 安装包和更新文件，输出到 `release/installers/`。
- `npm run dist:mac`：在 macOS 上生成 Apple 芯片和 Intel 的未签名测试包，输出到 `release/mac-test/`。GitHub 的 “Mac unsigned test” 工作流分别原生验证两个架构并发布独立预发布测试版。
- `release/installers/` 内保留当前版本的 `.exe`、同名 `.blockmap` 和配套 `latest.yml`。
- 不再为每次修复另建日期目录；重新构建前退出该目录中的程序。

旧的 `edge-fixed-20261127` 测试目录已清理。日常体验使用 `release/local/win-unpacked/Meridian.exe`，调试源码使用 `npm start`。

## 发布与版本

`package.json` 和 `package-lock.json` 的版本保持一致。发布时更新版本与说明，提交后推送同名标签（例如 `v1.2.1`）。GitHub Actions 将验证标签、运行检查并构建安装包，然后发布包含 `.exe`、`.blockmap` 和 `latest.yml` 的正式 Release。

客户端仅检查正式版本；保留三个更新文件，不要覆盖同一个版本的安装包。发现问题时发布更高的修复版本。可先用 `npm run dist` 在本机验证，构建文件位于 `release/installers/`。

首次发布 1.2.0 采用本机构建上传。后续标签由 [发布工作流](.github/workflows/release.yml) 处理；普通提交由 [检查工作流](.github/workflows/check.yml) 验证。

更新依赖 GitHub Releases 的可访问性；连接失败时可以稍后重试或手动下载。当前安装包未配置代码签名证书。

## 数据来源与源码

时区采用 IANA 数据及系统 Intl，国家与货币映射来自 Unicode CLDR；汇率源及其限制在工具中标注。ExchangeRate-API 数据不提供再次导出。

源码公开供查看，当前项目声明为 `UNLICENSED`，未授予通用开源许可。历史改动见 [桌面版记录](desktop/README.md)。
