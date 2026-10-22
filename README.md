# Watermark Studio · 本地批量图片水印工坊

> 纯前端、零上传的批量图片水印工具。**多图层**叠加文字与 Logo，九宫格 / 平铺 / 网格三种排版，透明度、字体、描边、阴影、背景色块全可调，基于 `Canvas + Web Worker` 批量渲染并打包 ZIP 下载。
>
> 参考并重写了 [cuijianzhuang/photo-watermark](https://github.com/cuijianzhuang/photo-watermark)（原生 JS 单文件版），在架构、功能深度与工程化上做了系统性升级。

![status](https://img.shields.io/badge/build-vite5-blue) ![stack](https://img.shields.io/badge/stack-React18%20%2B%20TS%20%2B%20Canvas-0b7285) ![license](https://img.shields.io/badge/license-MIT-green)

**在线试用**：<https://watermark-studio.edgeone.cool> · **代码**：<https://github.com/cccgitzh/watermark-studio>

![编辑器界面](docs/screenshots/editor-light.png)

<details>
<summary>更多截图（标签条样式 / 深色主题 / 移动端）</summary>

| 标签条 + 描边 | 深色主题 | 移动端 390px |
| --- | --- | --- |
| ![](docs/screenshots/label-chip.png) | ![](docs/screenshots/editor-dark.png) | ![](docs/screenshots/mobile.png) |

</details>

---

## 为什么重写

原项目是一个 60KB 的原生 JS 单文件应用：`index.html` + `css/styles.css` + `js/script.js`，靠全局变量与 DOM 查询驱动，功能集中在「文字水印 + 三种布局 + JSZip 批量下载」。它把「离线、隐私」这件事做对了，但代码结构与能力边界也停在那个阶段。

本项目保留它最重要的主张 —— **图片永远不离开浏览器** —— 并把水印从「一段文字」升级成「一套可复用的图层方案」，同时补齐了工程化底座（类型、模块边界、单测、构建、CI、部署）。

| 维度 | 原项目 | Watermark Studio |
| --- | --- | --- |
| 代码组织 | 单文件 60KB，全局函数 + DOM id 耦合 | `core`（纯逻辑）/ `state`（状态）/ `components`（视图）/ `workers`（渲染线程）四层分离，TypeScript 严格模式 |
| 水印模型 | 单一文字水印 | 多图层（文字 + Logo），每层独立排版、透明度、混合模式与层级顺序 |
| 排版 | 平铺 / 单点（5 个固定位）/ N 个等分 | 单点（九宫格 + 边距 + 百分比偏移 + **画布拖拽**）/ 平铺（横纵间距独立、错行、旋转扩边）/ 网格（任意行列） |
| 样式 | 字号倍率、颜色、透明度、旋转、加粗斜体 | 字体族与自定义字体上传、字重、字距、行高、斜体、描边、阴影、背景色块（圆角/内边距）、6 种混合模式 |
| 批量性能 | 主线程逐张绘制 | `OffscreenCanvas + Worker` 渲染池（并发 2），主线程不卡；不支持时自动回退主线程 |
| 导出 | 固定格式下载 | 格式（原格式/PNG/JPEG/WebP）、质量、长边上限、命名模板（6 个占位符）、ZIP 打包、剪贴板复制 |
| 编辑体验 | 无撤销 | 撤销/重做（连续滑动自动合并为一步）、快捷键、按住空格对比原图、主题切换 |
| 方案复用 | 无 | 6 套内置预设 + 自定义方案（localStorage）+ 方案 JSON 导入导出 |
| 图片处理 | 直接绘制 | EXIF 方向矫正、超 8192px 自动降采样、上限 60 张、逐张跳过/排序 |
| 质量保障 | 无测试 | 29 个单元测试（排版断行 / 布局几何 / 命名与格式）、`tsc --noEmit`、GitHub Actions CI |
| 部署 | GitHub Pages + Docker | EdgeOne Makers / EdgeOne Pages / GitHub Pages / Docker，含 PWA 离线安装 |

---

## 功能清单

### 水印能力
- **图层系统**：文字图层 + Logo 图层，最多 8 层，可显示/隐藏、复制、删除、上下移动
- **文字**：多行内容、回车换行、中文避头点避尾点自动断行、拉丁单词不拆词
- **字体**：8 组内置中英文字体栈 + 本地上传 `.ttf / .otf / .woff / .woff2`（会话内生效）
- **排版**：字号（按图片短边等比，跨分辨率一致）、字重 4 档、字距、行高、斜体
- **颜色与质感**：任意色值（支持 `rgba()`）、透明度、描边（宽度/颜色）、阴影（模糊/XY 偏移/颜色）、背景色块（颜色/透明度/内外边距/圆角）
- **叠加**：正常 / 正片叠底 / 滤色 / 叠加 / 柔光 / 差值，+ 旋转 -180°~180°
- **Logo**：PNG/SVG/WebP/JPEG，宽度按短边比例，同样支持旋转与混合模式

### 版式与定位
- **单点**：九宫格锚点 + 边距 + 水平/垂直百分比偏移，可直接在画布上拖动，或用方向键微调
- **平铺**：横纵间距独立（按水印自身尺寸计算）、隔行错位、旋转后自动扩边保证四角不漏印
- **网格**：1~8 行列任意，自动均分

### 批量与导出
- **导入**：点击 / 拖拽到窗口任意位置 / `Ctrl+V` 粘贴截图，单批最多 60 张
- **队列**：缩略图预览、点击切换、前后排序、单张跳过、单张移除、一键清空
- **导出**：原格式 / PNG / JPEG / WebP；压缩质量；长边上限（1280~8192）；命名模板 `{name} {index} {date} {w} {h} {ext}`
- **输出方式**：ZIP 打包、逐张下载、仅当前图片、复制到剪贴板
- **进度**：实时进度 + 已用时 + 预计剩余 + 失败计数，可中途取消

### 体验
- 撤销 / 重做（`Ctrl/⌘+Z`、`Ctrl/⌘+Shift+Z`、`Ctrl/⌘+Y`），滑杆连续调整合并为一步
- 按住 `空格` 快速对比原图
- 浅色 / 深色主题（跟随系统，可手动切换并记忆）
- 响应式三栏布局，窄屏自动降级为纵向堆叠
- PWA：可安装到桌面，断网可用

### 隐私
- 无后端、无分析脚本、无外部字体 CDN；构建产物不含任何第三方请求
- 图片仅存在于内存，刷新即清除；只有「方案（不含图片）」会写入 `localStorage`

---

## 快速开始

```bash
git clone https://github.com/cccgitzh/watermark-studio.git
cd watermark-studio
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # 类型检查 + 生产构建 → dist/
npm run preview    # 本地预览构建产物 http://localhost:4173
npm test           # 单元测试（vitest）
npm run typecheck  # 仅类型检查
```

要求 Node ≥ 18（推荐 20/22）。

---

## 项目结构

```
watermark-studio/
├── src/
│   ├── core/                   # 领域内核：不依赖 React，可独立测试
│   │   ├── types.ts            # 文档模型（图层 / 布局 / 导出设置）
│   │   ├── defaults.ts         # 默认值、字体表、预设、uid、克隆
│   │   ├── textLayout.ts       # 中英混排断行（避头点 / 避尾点 / 硬切）
│   │   ├── geometry.ts         # 锚点计算（单点 / 平铺 / 网格）、尺寸适配
│   │   ├── renderer.ts         # 唯一的绘制入口：底图 + 图层 → Canvas
│   │   ├── imageSource.ts      # 解码、EXIF 纠正、降采样、dataURL 互转
│   │   └── export.ts           # MIME/扩展名、命名模板、编码、下载、剪贴板
│   ├── workers/
│   │   ├── render.worker.ts    # OffscreenCanvas 渲染 + 编码
│   │   └── pool.ts             # 渲染池（排队 / 并发 / 主线程回退）
│   ├── state/
│   │   ├── editorStore.ts      # zustand：图层、导出、图片队列、撤销栈、预设
│   │   └── batchStore.ts       # 批处理进度与取消信号
│   ├── features/
│   │   └── batchExport.ts      # 批量导出编排（并发、命名、ZIP、复制）
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useLogoImages.ts    # dataURL Logo → ImageBitmap（带缓存）
│   ├── components/
│   │   ├── TopBar.tsx  LayersPanel.tsx  PreviewStage.tsx  Filmstrip.tsx
│   │   ├── Inspector.tsx        # 样式 / 布局 / 导出 / 方案 四个页签
│   │   ├── StylePanel.tsx  LayoutPanel.tsx  ExportPanel.tsx  PresetPanel.tsx
│   │   ├── controls.tsx         # 表单原语（滑杆 / 分段 / 开关 / 取色 / 九宫格）
│   │   ├── DropZone.tsx  ToastHost.tsx  ProgressOverlay.tsx  icons.tsx
│   ├── styles/                  # tokens.css（设计变量）/ base.css / panels.css
│   ├── App.tsx  main.tsx
├── tests/                       # 29 个单测：断行 / 几何 / 命名与格式
├── public/                      # favicon / manifest / service worker
├── docs/PLAN.md                 # 项目规划、功能清单、技术选型与路线图
├── .github/workflows/           # CI（类型检查 + 测试 + 构建）与 EdgeOne 部署
├── Dockerfile  nginx.conf       # 自托管方案
```

### 数据流

```
文件/剪贴板
   → decodeImage（EXIF 纠正、降采样）→ ImageBitmap 存入 editorStore.images
图层编辑 → editorStore.commit()（写撤销栈，滑杆按 key 合并）
        → PreviewStage 用 requestAnimationFrame 调 renderer 重绘预览（按显示尺寸 × DPR）
导出 → batchExport 逐张组装 RenderJob
        → RenderPool（Worker + OffscreenCanvas）渲染 → encodeCanvas → Blob
        → 命名模板 → ZIP / 单张下载 / 剪贴板
```

**设计要点**

1. **比例化参数**：字号、边距、间距、描边、阴影全部相对「图片短边」或「字号」表达，因此预览（几百 px）与导出（几千 px）视觉完全一致，同一套配置可跨分辨率复用。
2. **单一渲染入口**：`renderer.ts` 同时服务预览与导出，预览和成品不会出现「看起来不一样」的偏差。
3. **上下文无关的绘制**：`Ctx2D` 类型同时兼容 `CanvasRenderingContext2D` 与 `OffscreenCanvasRenderingContext2D`，同一份代码可在 Worker 中运行。
4. **可测内核**：断行与布局都是纯函数（注入 `measure`），不需要真实 Canvas 即可单测。

---

## 部署

### 方案一：EdgeOne Makers（推荐，CLI 一键）

```bash
npm i -g edgeone@latest      # 需 ≥ 1.6.0
edgeone login                # 浏览器授权
edgeone makers deploy -n watermark-studio --json
```

CLI 会自动识别 Vite 项目、执行 `npm run build` 并上传 `dist/`，返回形如
`https://watermark-studio-xxxx.edgeone.cool?eo_token=...&eo_time=...` 的访问地址（**必须带完整查询参数**，否则 401）。

CI 中可用 Token 部署，见 `.github/workflows/deploy-edgeone.yml`（需在仓库 Secrets 配置 `EDGEONE_API_TOKEN`）。

### 方案二：EdgeOne Pages 控制台（Git 自动构建）

1. 推送仓库到 GitHub；
2. EdgeOne 控制台 → Pages → 新建项目 → 关联该仓库；
3. 构建配置：

| 项 | 值 |
| --- | --- |
| 框架预设 | Vite |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | 20 |

4. 之后每次 push 到 `main` 自动构建发布，PR 生成预览环境。

> 本项目为纯静态 SPA，无路由、无环境变量、无 Node 运行时依赖，任何静态托管（EdgeOne / GitHub Pages / Netlify / Vercel / 对象存储 + CDN）都可用。`vite.config.ts` 的 `base` 默认为 `/`；若部署在子路径（如 `https://user.github.io/watermark-studio/`），把 `base` 改成 `'/watermark-studio/'`。

### 方案三：Docker 自托管

```bash
docker build -t watermark-studio .
docker run -d -p 8080:80 --name watermark watermark-studio
# → http://localhost:8080
```

镜像为多阶段构建：`node:20-alpine` 编译 → `nginx:alpine` 托管，`nginx.conf` 已配置 SPA 回退、gzip、静态资源长缓存与 CSP：

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:;
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

### 浏览器要求

| 能力 | 要求 | 降级行为 |
| --- | --- | --- |
| 基础水印 | 所有现代浏览器 | — |
| EXIF 自动纠正 | Chrome/Edge 90+、Safari 16+ | 按原始像素绘制 |
| Worker 渲染 | 支持 `OffscreenCanvas` | 自动回退主线程 |
| 自定义字体 | `FontFace` + `ArrayBuffer` | 不可用时按钮报错提示 |
| 复制到剪贴板 | `ClipboardItem`（需 HTTPS） | 按钮提示不支持 |

---

## 测试

```bash
npm test
```

| 文件 | 覆盖 |
| --- | --- |
| `tests/textLayout.test.ts` | 显式换行、折行宽度、避头点、避尾点、拉丁不拆词、超长硬切、空文本 |
| `tests/geometry.test.ts` | 九宫格坐标、边距与偏移、平铺覆盖率与对称性、旋转扩边、错行、网格数量与兜底、长边缩放 |
| `tests/export.test.ts` | MIME 映射（含 GIF/SVG → PNG）、扩展名、命名模板六种占位符、非法字符过滤、回退规则 |

---

## 路线图

- [ ] 图形水印（矩形遮罩 / 马赛克 / 模糊区域，用于证件号打码）
- [ ] 每张图片独立覆盖水印参数（当前为全局统一）
- [ ] 二维码 / 时间戳水印图层
- [ ] 拖拽调整平铺网格的手柄
- [ ] 中英双语界面（i18n）
- [ ] Playwright 端到端用例纳入 CI

## 许可

MIT。参考项目的版权归其原作者所有，详见 [LICENSE](./LICENSE) 与文首说明。
