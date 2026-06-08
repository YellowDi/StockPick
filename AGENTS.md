# StockPick 项目说明

本文件为 Codex 在本仓库工作时提供项目级指导。

## 语言

- 始终使用简体中文回复用户。
- Git commit message 始终使用英文。

## 项目概览

StockPick 是一个中文 A 股股票筛选看板原型。当前是 React/TypeScript 单页应用，后端 API 地址按环境分流：本地开发通过未提交的 `.env.development.local` 中的 `VITE_DEV_API_BASE_URL` 配置，生产默认使用同源 `/api/v1`。不要把真实服务器 IP/域名写入源码或文档。界面文案全部为中文。

## 命令

- `npm run dev`：启动 Vite dev server，通常在 5173 端口。除非用户明确要求，不要主动启动。
- 检查浏览器运行态时，先使用用户已打开或已说明的实际端口；不要假设 5173，尤其要确认页面标题为 StockPick。
- `npm run build`：执行 TypeScript 构建检查（`tsc -b`）并打包。代码改动后必须运行。
- `npm run preview`：预览生产构建。
- `npm run postinstall`：为 A 股涨跌颜色约定 patch `liveline`。依赖安装后自动运行。

## 架构

**应用壳层：** `src/App.tsx` 管理登录状态，并渲染 `LoginPage` 或 lazy-loaded `StockDashboard`。没有路由库，页面切换是布尔状态。

**看板主体：** 完整股票看板位于 `src/features/stock-board/stock-dashboard.tsx`（5000+ 行）。该文件包含主要 UI 组件、约 30 个 action variant 的 `useReducer`、辅助函数，以及移动端和桌面端响应式布局逻辑。

**API 层：**
- `src/lib/auth-api.ts`：JWT 登录和 token 管理，token 存在 `localStorage`，通过自定义事件通知过期。
- `src/lib/stock-api.ts`：后端接口的 typed async functions，包括股票列表、筛选列表、策略扫描/配置 CRUD、入选批次/记录 CRUD。

**关键源码文件：**
- `src/features/stock-board/stock-dashboard.tsx`：主看板，包括图表、股票列表、弹窗和状态管理。
- `src/features/strategy-switch/strategy-config.ts`：`StrategyConfig` 类型和默认值。
- `src/features/strategy-switch/strategy-switch-button.tsx`：策略配置弹窗。
- `src/components/login-page.tsx`：登录表单和 WebGL thread 动效。
- `src/components/threads.tsx`：基于 OGL/WebGL shader 的动态背景。
- `src/types/stock.ts`：`StockCandidate`、`StockDailyRecord`、`StockListKey`。
- `src/data/stock-list-meta.ts`：股票列表标签和说明元信息。
- `src/lib/utils.ts`：`cn()` 工具函数（clsx + tailwind-merge）。
- `src/styles/globals.css`：Tailwind CSS v4 和主题 CSS custom properties。

**样式：** 使用 `@tailwindcss/vite` 的 Tailwind CSS v4。暗色模式通过 `<html>` 上的 `.dark` class 控制，目前硬编码为 dark。`@` 路径别名指向 `./src`。

**图表：** 使用 `liveline`（v0.0.7）展示 K 线和折线图。`scripts/patch-liveline-a-share-colors.mjs` 会替换 liveline 源码中的红绿颜色，以符合 A 股约定，不要删除该脚本。

**UI 组件：** 使用 HeroUI v3（`@heroui/react`、`@heroui/styles`）。图标使用 Remix Icon（`@remixicon/react`），不要新增或继续使用 `lucide-react`。

**包管理器：** pnpm。

## 产品约束

- A 股颜色约定：上涨为红色，下跌为绿色（`--stock-up` / `--stock-down` CSS variables）。
- 保持看板作为第一屏，不要改成营销页或落地页。
- 界面应偏交易工具风格：信息密度高、易扫读、状态明确。
- 四列股票列表（初筛/已选/白名单/黑名单）支持 HTML5 drag-and-drop 跨列拖拽。
- 不要新增运行时依赖，除非用户确认。
- 不要新增 mock 数据替代现有后端接口，除非用户明确要求。
- 修改图表行为前，先确认 `liveline` 的实际 API 和当前用法。
- 除非用户要求路由或模块拆分，否则保持现有单页结构。

## 验证

- 代码改动后运行 `npm run build`。
- UI/交互改动由用户手动在浏览器检查；除非用户明确要求，不要启动 dev server，也不要主动做浏览器验证。
- 纯文档改动使用 `git diff --check` 验证。
- 如果验证命令失败，最终回复必须说明具体原因。
