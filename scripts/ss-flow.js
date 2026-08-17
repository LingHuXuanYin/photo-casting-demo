// 简化版：测 Dashboard 在不同状态下的样子
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 清掉之前的 project
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('model-card-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. 空状态
  await page.screenshot({ path: 'ss-flow-1-empty.png' });
  console.log('1. 空状态 Dashboard');

  // 2. 进 editor（点新建第一个项目）
  await page.locator('button:has-text("新建第一个项目")').click();
  await page.waitForTimeout(2000);

  // 应用黑白大片模板（用 Toolbar 里的"模板"按钮）
  await page.locator('button:has-text("模板")').first().click();
  await page.waitForTimeout(800);
  // 弹层里点"黑白大片"
  await page.locator('text=黑白大片').first().click();
  await page.waitForTimeout(500);
  // 弹层底部"应用模板"按钮
  await page.locator('button:has-text("应用模板")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'ss-flow-2-editor-with-template.png' });
  console.log('2. Editor + 黑白大片模板');

  // 等自动保存
  await page.waitForTimeout(3000);

  // 3. 点"← 我的项目"回 Dashboard
  await page.locator('button:has-text("我的项目")').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'ss-flow-3-dashboard-with-1.png' });
  console.log('3. Dashboard 看到 1 个项目');

  // 4. 验证卡片数
  const cardCount = await page.locator('.project-card').count();
  const newBtn = await page.locator('.project-card-new').count();
  const dataCards = await page.locator('.project-card:not(.project-card-new)').count();
  console.log(`  project-card 总数: ${cardCount}`);
  console.log(`  新建占位卡: ${newBtn}`);
  console.log(`  真实项目卡: ${dataCards}`);

  // 5. 测搜索：在搜索框输入"未命名"
  await page.locator('.dashboard-search').fill('未命名');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ss-flow-4-search.png' });
  console.log('4. 搜索 "未命名"');
  await page.locator('.dashboard-search').fill('');

  // 6. 测删除（先点"我的项目"卡片回来）
  await page.locator('.project-card:not(.project-card-new)').hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ss-flow-5-hover-delete.png' });
  console.log('5. 悬停卡片显示删除按钮');

  // 点删除按钮
  await page.locator('.project-card-actions .icon-btn').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ss-flow-6-confirm-delete.png' });
  console.log('6. 弹出删除确认');
  // 取消（避免真删了）
  await page.locator('.confirm-modal button:has-text("取消")').click();
  await page.waitForTimeout(500);

  console.log('\n✓ 全部截图完成');
  await browser.close();
})().catch((err) => {
  console.error('失败：', err);
  process.exit(1);
});
