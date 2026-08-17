// 模拟完整流程：建一个项目 → 填资料 → 应用模板 → 导出 → 回到 Dashboard 看卡片
const { chromium } = require('playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  // 用干净的 IDB（每次 newContext 是新 origin，但 IndexedDB 是持久化的）
  // 先清掉之前的 project
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('model-card-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  // 清掉 localStorage
  await page.evaluate(() => localStorage.clear());

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. 空状态截图
  await page.screenshot({ path: 'ss-1-empty.png' });
  console.log('1. 空状态截图: ss-1-empty.png');

  // 2. 点"新建第一个项目"
  await page.locator('button:has-text("新建第一个项目")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'ss-2-editor.png' });
  console.log('2. 进 editor 截图: ss-2-editor.png');

  // 3. 选模板（点"模板"按钮）
  await page.locator('button:has-text("模板")').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'ss-3-template-gallery.png' });
  console.log('3. 模板选择弹层: ss-3-template-gallery.png');

  // 4. 选"黑白大片"（最后一个模板）
  const templateCount = await page.locator('.tpl-card, .template-card, [class*="template"]').count();
  console.log('  模板选项数:', templateCount);

  // 试一下找"黑白大片"按钮
  const bwBtn = page.locator('text=黑白大片').first();
  if (await bwBtn.isVisible().catch(() => false)) {
    await bwBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'ss-4-template-applied.png' });
    console.log('4. 模板已应用: ss-4-template-applied.png');
  } else {
    console.log('4. 找不到"黑白大片"模板，跳过');
  }

  // 5. 填模特信息（点"模特信息"按钮）
  await page.locator('button:has-text("模特信息")').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'ss-5-model-modal.png' });
  console.log('5. 模特信息弹层: ss-5-model-modal.png');

  // 填几个字段
  const nameInput = page.locator('input[type="text"]').filter({ hasText: '' }).first();
  // 直接用 label 找
  const allInputs = await page.locator('.modal-box input').all();
  for (const inp of allInputs) {
    const ph = await inp.getAttribute('placeholder');
    if (ph && (ph.includes('姓名') || ph.includes('name'))) {
      await inp.fill('林若汐');
      break;
    }
  }
  // 身高
  for (const inp of allInputs) {
    const ph = await inp.getAttribute('placeholder');
    if (ph && ph.includes('身高')) {
      await inp.fill('167');
      break;
    }
  }
  // 体重
  for (const inp of allInputs) {
    const ph = await inp.getAttribute('placeholder');
    if (ph && ph.includes('体重')) {
      await inp.fill('45');
      break;
    }
  }
  await page.screenshot({ path: 'ss-6-model-filled.png' });
  console.log('6. 模特信息已填: ss-6-model-filled.png');

  // 关闭弹层
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // 等自动保存（2s 防抖）
  await page.waitForTimeout(3000);

  // 7. 点"返回我的项目"
  await page.locator('button:has-text("我的项目")').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'ss-7-dashboard-with-project.png' });
  console.log('7. 回到 Dashboard（有 1 个项目）: ss-7-dashboard-with-project.png');

  // 检查 Dashboard 状态
  const cardCount = await page.locator('.project-card').count();
  const newCardCount = await page.locator('.project-card-new').count();
  console.log(`\nDashboard 卡片统计:`);
  console.log(`  project-card (普通项目): ${cardCount}`);
  console.log(`  project-card-new (新建占位): ${newCardCount}`);

  // 8. 导出一下（让缩略图生成）
  await page.locator('.project-card:not(.project-card-new)').first().click();
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("导出")').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ss-8-export-modal.png' });
  console.log('8. 导出弹层: ss-8-export-modal.png');

  await page.locator('.modal-box button:has-text("导出")').last().click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'ss-9-exported.png' });
  console.log('9. 导出完成: ss-9-exported.png');

  // 关闭弹层
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // 等缩略图存盘
  await page.waitForTimeout(3000);

  // 10. 回到 Dashboard
  await page.locator('button:has-text("我的项目")').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'ss-10-dashboard-with-thumb.png' });
  console.log('10. Dashboard 带缩略图: ss-10-dashboard-with-thumb.png');

  if (errors.length > 0) {
    console.log('\n--- 错误 ---');
    errors.forEach((e) => console.log('  ' + e));
  }

  await browser.close();
  console.log('\n✓ 全部截图完成');
})().catch((err) => {
  console.error('脚本失败：', err);
  process.exit(1);
});
