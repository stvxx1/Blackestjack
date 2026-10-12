/**
 * Browser smoke test against a running build (`npm run build && npm run preview`).
 *
 *   BASE_URL=http://localhost:4173 CHROMIUM_PATH=/path/to/chrome node e2e/smoke.mjs [screenshotDir]
 *
 * Checks every route at phone and desktop widths for console errors and horizontal
 * overflow, then plays rounds on the table with the keyboard alone.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const shots = process.argv[2];
const ROUTES = ['table', 'trainer', 'counting', 'stats', 'settings'];
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 860 } };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
const fail = (msg) => failures.push(msg);

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fail(`${name}: page error: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error') fail(`${name}: console error: ${m.text()}`); });

  for (const route of ROUTES) {
    await page.goto(`${BASE}/#/${route}`);
    await page.waitForTimeout(500);
    const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    if (scroll > inner) fail(`${name} ${route}: horizontal overflow (${scroll}px > ${inner}px)`);
    const h1 = await page.title();
    if (!h1.includes('BlackjackWiz')) fail(`${name} ${route}: unexpected title "${h1}"`);
    if (shots) await page.screenshot({ path: `${shots}/${name}-${route}.png`, fullPage: route !== 'table' });
  }

  // Keyboard-only rounds: deal with Enter, decline insurance with N, stand with S.
  await page.goto(`${BASE}/#/table`);
  await page.waitForTimeout(300);
  let completed = 0;
  for (let round = 0; round < 5; round++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    if (await page.getByRole('button', { name: /No thanks/ }).count()) await page.keyboard.press('n');
    for (let i = 0; i < 6; i++) {
      const stand = page.getByRole('button', { name: /^Stand/ });
      if (!((await stand.count()) && (await stand.isEnabled()))) break;
      await page.keyboard.press('s');
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2500);
    if (await page.getByRole('button', { name: /Deal again/ }).count()) completed++;
  }
  if (completed !== 5) fail(`${name}: only ${completed}/5 keyboard rounds completed`);
  const statsText = await (async () => {
    await page.goto(`${BASE}/#/stats`);
    await page.waitForTimeout(300);
    return page.locator('main').innerText();
  })();
  if (!/5 rounds/.test(statsText)) fail(`${name}: stats did not record 5 rounds`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`✗ ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('✓ smoke: all routes, both viewports, keyboard play, no console errors, no overflow');
