import fs from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.LEGACY_UI_URL || 'http://localhost:3100/index.html';
const apiUrl = process.env.API_BASE_URL || 'http://localhost:3100/api';
const username = process.env.SMOKE_ADMIN_USER || 'admin';
const password = process.env.SMOKE_ADMIN_PASSWORD || 'admin1234';
const outDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'output/playwright';

const { chromium } = await import('playwright');

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

try {
  await page.addInitScript((value) => {
    window.TW_API_URL = value;
  }, apiUrl);

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.fill('#liUser', username);
  await page.fill('#liPass', password);
  await page.click('#liBtn');
  await page.waitForSelector('#main:not(.d-none)', { timeout: 10000 });

  const title = await page.locator('#hTitle').innerText();
  const homeText = await page.locator('#view').innerText({ timeout: 10000 });
  const tabs = [];
  for (const tab of ['locations', 'receive', 'exchange', 'settings', 'home']) {
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForTimeout(700);
    tabs.push({ tab, text: (await page.locator('#view').innerText()).slice(0, 160) });
  }

  const screenshotPath = path.join(outDir, 'legacy-ui-smoke.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const blockingErrors = consoleErrors.filter((error) => !/favicon|manifest|service worker/i.test(error));
  const result = {
    status: blockingErrors.length ? 'warning' : 'success',
    app_url: appUrl,
    api_url: apiUrl,
    title,
    dashboard_has_imported_data: /26|ใกล้หมด|หมดอายุ|รายการ|สต็อก/.test(homeText),
    tabs,
    console_errors: consoleErrors,
    screenshot: screenshotPath,
  };

  await fs.writeFile(path.join(outDir, 'legacy-ui-smoke.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'success') process.exitCode = 1;
} finally {
  await browser.close();
}
