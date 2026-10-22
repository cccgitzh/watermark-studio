/**
 * 端到端冒烟测试：在真实 Chromium 中跑完导入 → 编辑 → 打码 → 批量导出 → 响应式。
 *
 * 运行前提：本机已安装 Chrome（Playwright 用 channel: 'chrome'，无需下载浏览器）
 *   npm install
 *   npm run build
 *   npm run test:e2e          # 脚本会自动起 vite preview
 *   E2E_BASE_URL=https://... npm run test:e2e   # 也可直接压线上地址
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const artifacts = path.join(here, '.artifacts');
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const fixture = (name) => path.join(here, 'fixtures', name);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const waitForServer = async (url, timeout) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // 服务未起来，继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return false;
};

const needServer = !process.env.E2E_BASE_URL && !(await waitForServer(BASE, 1200));
// 直接用 node 执行 vite 的 bin，避免 Windows 下 spawn .cmd 的 EINVAL
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const server = needServer
  ? spawn(process.execPath, [viteBin, 'preview', '--port', '4173', '--host', '127.0.0.1'], {
      cwd: root,
      stdio: 'ignore',
    })
  : null;

if (!(await waitForServer(BASE, 40000))) {
  console.error('无法访问预览服务，请先执行 npm run build');
  server?.kill();
  process.exit(2);
}

mkdirSync(artifacts, { recursive: true });
const shot = (name) => path.join(artifacts, name);

const canvasMean = `(() => {
  const c = document.querySelector('canvas.preview-canvas');
  if (!c) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 29) { sum += (d[i] + d[i+1] + d[i+2]) / 3; n++; }
  return { mean: sum / n, w: c.width, h: c.height };
})()`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const external = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('request', (request) => {
  const url = request.url();
  if (!url.startsWith(BASE) && !url.startsWith('data:') && !url.startsWith('blob:')) {
    external.push(url);
  }
});

try {
  // 1. 首屏
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('页面标题正确', (await page.title()).includes('Watermark Studio'));
  check('空状态显示拖拽区', await page.locator('.dropzone h2').isVisible());
  await page.screenshot({ path: shot('01-empty.png') });

  // 2. 首张上传
  await page.setInputFiles('.dropzone input[type="file"]', [fixture('card.png')]);
  await page.waitForSelector('canvas.preview-canvas', { timeout: 15000 });
  await page.waitForTimeout(500);
  check('首张图片上传成功', (await page.locator('.thumb:not(.thumb-add)').count()) === 1);
  const meta = await page.locator('.stage-meta').innerText();
  check('相纸说明行显示尺寸与格式', meta.includes('640') && meta.includes('400'), meta.replace(/\n/g, ' '));

  // 3. 回归：上传后仍可继续添加图片（此前无入口）
  check('纸张抬头出现「添加图片」入口', await page.locator('.sheet-actions .button').first().isVisible());
  await page.setInputFiles('.sheet-actions input[type="file"]', [fixture('photo.png')]);
  await page.waitForTimeout(600);
  check('通过队列入口追加第二张', (await page.locator('.thumb:not(.thumb-add)').count()) === 2);
  check('缩略图末尾有「+ 添加」格子', await page.locator('.thumb-add').isVisible());

  const withMark = await page.evaluate(canvasMean);
  check('预览画布已绘制', Boolean(withMark && withMark.w > 0), JSON.stringify(withMark));
  await page.screenshot({ path: shot('02-watermarked.png') });

  // 4. 对比原图
  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  const original = await page.evaluate(canvasMean);
  await page.keyboard.up('Space');
  await page.waitForTimeout(250);
  check(
    '水印确实绘制在图上（画面变暗）',
    original.mean > withMark.mean + 0.3,
    `原图 ${original.mean.toFixed(2)} vs 水印 ${withMark.mean.toFixed(2)}`,
  );

  // 5. 新增文字图层 + 撤销 / 重做
  await page.getByRole('button', { name: '添加文字水印' }).click();
  await page.waitForTimeout(250);
  check('图层数增加到 2', (await page.locator('.layer-item').count()) === 2);
  const textarea = page.locator('textarea').first();
  await textarea.fill('机密文件 · 禁止外传');
  await page.waitForTimeout(400);
  await page.waitForTimeout(900);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check('Ctrl+Z 撤销文案', (await textarea.inputValue()) !== '机密文件 · 禁止外传');
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(300);
  check('Ctrl+Shift+Z 重做文案', (await textarea.inputValue()) === '机密文件 · 禁止外传');

  // 6. 单点布局 + 画布拖拽 + 方向键微调
  await page.getByRole('tab', { name: '布局' }).click();
  await page.getByRole('tab', { name: '单点' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('radio', { name: '右下' }).click();
  await page.waitForTimeout(250);
  check(
    '切换到单点 + 右下锚点',
    (await page.getByRole('radio', { name: '右下' }).getAttribute('aria-checked')) === 'true',
  );

  const box = await page.locator('canvas.preview-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.85);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.6, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const offsetsAfterDrag = await page.locator('.slider-value').allInnerTexts();
  check(
    '拖拽画布改变偏移量',
    offsetsAfterDrag.some((text) => /^-?\d+(\.\d+)?%$/.test(text) && Math.abs(parseFloat(text)) > 1),
    offsetsAfterDrag.join(' / '),
  );

  await page.waitForTimeout(900);
  const beforeNudge = await page.evaluate(canvasMean);
  await page.locator('canvas.preview-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  const afterNudge = await page.evaluate(canvasMean);
  check('方向键微调生效（画面变化）', beforeNudge.mean !== afterNudge.mean);
  await page.screenshot({ path: shot('03-single.png') });

  // 7. 打码图层：默认区域 + 拖拽框选 + 马赛克生效
  const redactBox = { x: 0.3, y: 0.33, w: 0.34, h: 0.12 };
  // 用「相邻像素差」衡量高频细节：马赛克把块内像素抹平后该值会大幅下降
  const regionMetrics = (region) =>
    page.evaluate(({ region }) => {
      const c = document.querySelector('canvas.preview-canvas');
      const ctx = c.getContext('2d');
      const x = Math.round(region.x * c.width);
      const y = Math.round(region.y * c.height);
      const w = Math.max(1, Math.round(region.w * c.width));
      const h = Math.max(1, Math.round(region.h * c.height));
      const d = ctx.getImageData(x, y, w, h).data;
      const lum = (i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
      let sum = 0;
      let sum2 = 0;
      let hf = 0;
      let n = 0;
      let hn = 0;
      for (let row = 0; row < h; row += 1) {
        for (let col = 0; col < w; col += 1) {
          const i = (row * w + col) * 4;
          const v = lum(i);
          sum += v;
          sum2 += v * v;
          n += 1;
          if (col + 1 < w) {
            hf += Math.abs(v - lum(i + 4));
            hn += 1;
          }
        }
      }
      const mean = sum / n;
      return { std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), hf: hf / hn, mean };
    }, { region });

  const metricsBefore = await regionMetrics(redactBox);
  await page.getByRole('button', { name: '添加打码' }).click();
  await page.waitForTimeout(400);
  check('打码图层已添加', (await page.locator('.layer-item').count()) === 3);
  check('默认带一个打码区域', (await page.locator('.redact-region').count()) === 1);

  const canvasBox = await page.locator('canvas.preview-canvas').boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.32, canvasBox.y + canvasBox.height * 0.34);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.62, canvasBox.y + canvasBox.height * 0.45, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  check('拖拽可新增打码区域', (await page.locator('.redact-region').count()) === 2);
  const metricsAfter = await regionMetrics(redactBox);
  check(
    '马赛克抹掉了区域高频细节（打码真实生效）',
    metricsBefore.hf > 4 && metricsAfter.hf < metricsBefore.hf * 0.35,
    `高频差 ${metricsBefore.hf.toFixed(2)} → ${metricsAfter.hf.toFixed(2)} · std ${metricsBefore.std.toFixed(1)} → ${metricsAfter.std.toFixed(1)}`,
  );
  // 7.1 另外两种打码模式
  await page.getByRole('tab', { name: '样式' }).click();
  await page.getByRole('tab', { name: '模糊' }).click();
  await page.waitForTimeout(450);
  const blurMetrics = await regionMetrics(redactBox);
  check(
    '模糊模式生效',
    blurMetrics.hf < metricsBefore.hf * 0.55,
    `高频差 ${metricsBefore.hf.toFixed(2)} → ${blurMetrics.hf.toFixed(2)}`,
  );

  await page.getByRole('tab', { name: '纯色' }).click();
  await page.waitForTimeout(450);
  // 取两个区域的重叠中心的小块，避免量到区域边缘外的底图
  const solidMetrics = await regionMetrics({ x: 0.35, y: 0.355, w: 0.18, h: 0.045 });
  check(
    '纯色模式生效（区域被纯色覆盖）',
    solidMetrics.std < 4 && solidMetrics.mean < 60,
    `mean=${solidMetrics.mean.toFixed(1)} std=${solidMetrics.std.toFixed(2)}`,
  );

  await page.getByRole('tab', { name: '马赛克' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('04-redact.png') });

  // 8. 预设
  await page.getByRole('tab', { name: '方案' }).click();
  await page.getByRole('button', { name: /证件防盗用/ }).click();
  await page.waitForTimeout(500);
  check('应用内置方案替换图层', (await page.locator('.layer-item').count()) === 1);

  // 9. 导出
  await page.getByRole('tab', { name: '导出' }).click();
  await page.getByRole('tab', { name: 'JPEG' }).click();
  await page.waitForTimeout(250);
  const sampleName = await page.locator('.file-preview').innerText();
  check('命名模板生成示例名', sampleName.includes('card-watermark.jpg'), sampleName);

  const downloadPromise = page.waitForEvent('download', { timeout: 40000 });
  await page.locator('.inspector').getByRole('button', { name: /导出全部（ZIP）/ }).click();
  const download = await downloadPromise;
  const zipPath = path.join(artifacts, 'out.zip');
  await download.saveAs(zipPath);
  check('ZIP 下载完成', statSync(zipPath).size > 5000, `${(statSync(zipPath).size / 1024).toFixed(1)} KB`);

  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const entries = Object.keys(zip.files);
  check(
    'ZIP 内含 2 张按模板命名的 JPG',
    entries.length === 2 && entries.every((n) => n.endsWith('.jpg') && n.includes('watermark')),
    entries.join(', '),
  );
  const buffer = await zip.file(entries[0]).async('nodebuffer');
  check('JPEG 文件头合法', buffer.slice(0, 2).toString('hex') === 'ffd8');

  const singlePromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('.inspector').getByRole('button', { name: '仅当前图片' }).click();
  const single = await singlePromise;
  check('单张导出使用命名模板', /card/.test(single.suggestedFilename()), single.suggestedFilename());

  // 10. 主题与响应式
  await page.locator('.topbar button[title*="深色"], .topbar button[title*="浅色"]').click();
  await page.waitForTimeout(300);
  check('深色主题切换', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.screenshot({ path: shot('05-dark.png') });
  await page.locator('.topbar button[title*="浅色"]').click();
  await page.waitForTimeout(200);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  check('390px 无横向溢出', scrollWidth <= 391, `scrollWidth=${scrollWidth}`);
  await page.screenshot({ path: shot('06-mobile.png') });

  // 11. 隐私与稳定性
  check('零外部网络请求', external.length === 0, external.slice(0, 3).join(', '));
  check('无未捕获页面异常', pageErrors.length === 0, pageErrors.join(' | '));
  check('无控制台 error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  server?.kill();
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  failed.forEach((item) => console.log(` - ${item.name}${item.detail ? ` :: ${item.detail}` : ''}`));
  process.exit(1);
}
