const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: 'video', size: { width: 1440, height: 900 } },
  });

  const base = process.env.BASE_URL || 'http://localhost:3100';
  const walk = async (url, waitMs) => {
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(waitMs);
  };

  await walk('/', 2500);
  await walk('/incidents', 2000);
  const inc = await page.getByRole('link').filter({ hasText: /incident/i }).first();
  await inc.click().catch(() => {});
  await page.waitForTimeout(2500);
  await walk('/repos', 2000);
  const repo = await page.getByRole('link').filter({ hasText: /express/i }).first();
  await repo.click().catch(() => {});
  await page.waitForTimeout(2500);
  await walk('/engineers', 2000);
  const eng = await page.getByRole('link').filter({ hasText: /sarah/i }).first();
  await eng.click().catch(() => {});
  await page.waitForTimeout(2500);
  await walk('/pathfinder', 2000);
  await page.waitForTimeout(2500);

  await browser.close();
  console.log('done');
})();