const { chromium } = require('playwright');

(async () => {
  const PORT = 3000;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  // Navigate to welcome page
  const resp = await page.goto(`http://localhost:${PORT}/welcome`, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Status:', resp?.status());
  await page.waitForTimeout(3000);

  // Click Lo-fi Beat - find the button more carefully
  const lofiBtn = page.locator('button:has-text("Lo-fi")').first();
  const lofiCount = await lofiBtn.count();
  console.log('Lo-fi buttons:', lofiCount);

  if (lofiCount === 0) {
    // Debug what buttons exist
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.substring(0, 50),
        rect: b.getBoundingClientRect()
      }))
    );
    console.log('All buttons:', JSON.stringify(allBtns));
    await browser.close();
    process.exit(1);
  }

  await lofiBtn.click();
  console.log('Clicked Lo-fi');

  // Wait for navigation to project page
  await page.waitForURL('**/project/**', { timeout: 20000 });
  await page.waitForTimeout(5000);

  console.log('URL:', page.url());

  // Find solo buttons
  const soloStates = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const solos = btns.filter(b => b.textContent.trim() === 'S');
    return solos.map((b, i) => ({ i, active: b.className.includes('yellow') }));
  });
  console.log(`Solo buttons: ${soloStates.length}`);
  if (soloStates.length < 3) {
    console.log('FAIL: need 3+ tracks');
    await browser.close();
    process.exit(1);
  }

  // Helper functions
  async function clickSolo(idx, mod = {}) {
    return await page.evaluate(({ idx, ctrl, alt }) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const s = btns.filter(b => b.textContent.trim() === 'S')[idx];
      if (!s) return 'no btn';
      s.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, button: 0,
        ctrlKey: ctrl, metaKey: ctrl, altKey: alt
      }));
      return new Promise(r => setTimeout(() => r(s.className.includes('yellow')), 200));
    }, { idx, ctrl: !!mod.ctrl, alt: !!mod.alt });
  }

  async function getStates() {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter(b => b.textContent.trim() === 'S')
        .map((b, i) => ({ i, active: b.className.includes('yellow') }))
    );
  }

  // === TEST 1: Normal solo ===
  await clickSolo(0);
  let s = await getStates();
  const t1 = s[0].active && !s[1].active && !s[2].active;
  await clickSolo(0);  // clear
  console.log(`1. Normal click: ${t1 ? 'PASS' : 'FAIL'}`);

  // === TEST 2: Ctrl+Click ===
  let r = await clickSolo(0, { ctrl: true });
  console.log('  clickSolo(0,ctrl) returned:', JSON.stringify(r));
  s = await getStates();
  console.log('  after ctrl+track0:', JSON.stringify(s));
  await clickSolo(1, { ctrl: true });
  s = await getStates();
  console.log('  after ctrl+track1:', JSON.stringify(s));
  const t2 = s[0].active && s[1].active && !s[2].active;
  await clickSolo(0);  // clear
  s = await getStates();
  console.log('  after clear:', JSON.stringify(s));
  console.log(`2. Ctrl+click: ${t2 ? 'PASS' : 'FAIL'}`);

  // === TEST 3: Alt+Click ===
  await clickSolo(2, { alt: true });
  s = await getStates();
  const t3 = !s[0].active && !s[1].active && s[2].active;
  await clickSolo(2);  // clear
  s = await getStates();
  const t4 = s.every(x => !x.active);
  console.log(`3. Alt+click: ${t3 ? 'PASS' : 'FAIL'}`);
  console.log(`4. Clear all: ${t4 ? 'PASS' : 'FAIL'}`);

  const passed = t1 && t2 && t3 && t4;
  console.log(`\n${passed ? 'ALL PASSED' : 'FAILURES'}`);

  const realErrors = errors.filter(e =>
    !e.toLowerCase().includes('hydration') &&
    !e.toLowerCase().includes('404') &&
    !e.toLowerCase().includes('not found')
  );
  if (realErrors.length) console.log('Errors:', realErrors);

  await browser.close();
  process.exit(passed ? 0 : 1);
})().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
