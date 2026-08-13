const { chromium } = require('playwright')

const shots = [
  ['home', 'http://localhost:3100/'],
  ['incidents', 'http://localhost:3100/incidents'],
  ['incident-detail', 'http://localhost:3100/incidents/vercel%7Cxfkn71bbvc99'],
  ['repo-detail', 'http://localhost:3100/repos/vitejs%2Fvite'],
  ['pathfinder', 'http://localhost:3100/pathfinder'],
  ['engineers', 'http://localhost:3100/engineers'],
]

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  for (const [name, url] of shots) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `docs/screenshots/${name}.png` })
    console.log('captured', name)
  }
  await browser.close()
})()
