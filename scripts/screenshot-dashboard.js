// 用 playwright 实际打开 dev server 截图，验证 Dashboard 显示正常
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 抓 console 错误
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  console.log('打开 http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });

  // 等 React 渲染
  await page.waitForTimeout(2000);

  // 检查是否看到 Dashboard
  const titleVisible = await page.locator('h1:has-text("模特卡片生成器")').isVisible().catch(() => false);
  const newBtnVisible = await page.locator('button:has-text("新建项目")').first().isVisible().catch(() => false);
  const editorVisible = await page.locator('.canvas-area').isVisible().catch(() => false);
  const dashVisible = await page.locator('.dashboard').isVisible().catch(() => false);
  const emptyVisible = await page.locator('.dashboard-empty').isVisible().catch(() => false);
  const gridVisible = await page.locator('.dashboard-grid').isVisible().catch(() => false);

  console.log('\n--- 检测结果 ---');
  console.log('  H1 "模特卡片生成器":', titleVisible ? '✓' : '✗');
  console.log('  "新建项目" 按钮:', newBtnVisible ? '✓' : '✗');
  console.log('  Dashboard 容器:', dashVisible ? '✓' : '✗');
  console.log('  空状态卡片:', emptyVisible ? '✓' : '✗');
  console.log('  项目网格:', gridVisible ? '✓' : '✗');
  console.log('  Editor 画布:', editorVisible ? '⚠ 看到 editor（说明 view 跳错了）' : '✓ 没看到 editor');

  // 截图
  await page.screenshot({ path: 'screenshot-dashboard.png', fullPage: false });
  console.log('\n截图保存: screenshot-dashboard.png');

  // 输出 URL + 浏览器看到的 HTML
  console.log('URL:', page.url());
  const title = await page.title();
  console.log('Title:', title);

  if (errors.length > 0) {
    console.log('\n--- Console 错误 ---');
    errors.forEach((e) => console.log('  ' + e));
  } else {
    console.log('\n无 console 错误 ✓');
  }

  await browser.close();
})().catch((err) => {
  console.error('脚本失败：', err);
  process.exit(1);
});
