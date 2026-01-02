import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE console', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR', err.message));
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.click('button[aria-label= REWARDS]');
  await page.waitForTimeout(5000);
  await browser.close();
})();
