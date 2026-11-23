// Disposable Chromium browser smoke tests against localhost production image.
// This cannot replace real-device Safari and Android testing.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const requireFrontend = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = requireFrontend('playwright')

const ROOT = 'http://127.0.0.1:8080'
const results = []
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] })
const run = async (name, fn) => {
  try {
    await fn()
    results.push({ name, status: 'PASS' })
    console.log('PASS', name)
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error) })
    console.error('FAIL', name, error)
  }
}

try {
  const context = await browser.newContext({ viewport: {width: 1366, height: 900} })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response',response=>{if(response.url().includes('/api/')) console.log('DESKTOP_API', response.request().method(), response.status(), response.url())})
  page.on('console',msg=>{if(msg.type()==='error')console.log('DESKTOP_CONSOLE_ERROR',msg.text())})
  await run('Desktop welcome screen and app branding', async () => {
    const response = await page.goto(ROOT + '/', {waitUntil: 'domcontentloaded'})
    assert.equal(response.status(), 200)
    await page.getByRole('heading', {name: 'Start your family story'}).waitFor({timeout:15000})
    assert.equal(await page.title(), 'Family Tree')
  })
  await run('Guest tree creation through actual UI', async () => {
    await page.getByPlaceholder('Tree name, e.g. The Novak Family').fill('QA browser regression')
    await page.getByRole('button', {name:'Create family tree'}).click()
    try { await page.waitForFunction(() => /^\/trees\/[0-9a-f-]{36}$/.test(location.pathname), null, {timeout:15000}) } catch(error) { console.log('CREATE_TREE_DIAGNOSTIC', JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,1400),localStorage:await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))})); throw error }
    await page.getByRole('heading', {name:'Your tree is ready'}).waitFor()
    const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('family-tree-guest-tree-ids') || '[]'))
    assert.ok(ids.length >= 1)
    assert.ok(ids.every(id => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)))
  })
  const treeUrl = page.url()
  await run('Browser refresh preserves guest tree', async () => {
    await page.reload({waitUntil:'domcontentloaded'})
    await page.getByRole('heading',{name:'Your tree is ready'}).waitFor({timeout:15000})
    assert.equal(page.url(),treeUrl)
  })
  await run('Add first person and see node on canvas', async () => {
    await page.getByRole('button',{name:'Add first person'}).click()
    await page.locator('form.person-form input[name="firstName"]').fill('BrowserQA')
    await page.getByRole('button',{name:'Save person'}).click()
    await page.locator('.person-node',{hasText:'BrowserQA'}).first().waitFor({timeout:20000})
  })
  await run('Search a person and focus node', async () => {
    await page.getByRole('button',{name:'Open menu'}).click()
    await page.getByPlaceholder('Search people…').fill('BrowserQA')
    await page.getByRole('button',{name:/BrowserQA/}).last().click()
    await page.locator('.person-node',{hasText:'BrowserQA'}).first().waitFor()
  })
  await run('English/Slovenian language switching', async () => {
    await page.getByRole('combobox',{name:'Language'}).selectOption('sl')
    await page.getByRole('combobox',{name:'Jezik'}).waitFor()
    await page.getByRole('combobox',{name:'Jezik'}).selectOption('en')
    await page.getByRole('combobox',{name:'Language'}).waitFor()
  })
  await run('Direct tree URL works in authorized browser', async () => {
    await page.goto(treeUrl)
    await page.locator('.person-node',{hasText:'BrowserQA'}).first().waitFor({timeout:20000})
  })
  await run('Desktop browser console free from uncaught exceptions', async () => {
    assert.deepEqual(errors, [])
  })
  await context.close()

  const mobile = await browser.newContext({
    viewport: {width:390, height:844},
    deviceScaleFactor:3,
    isMobile:true,
    hasTouch:true,
  })
  const mp = await mobile.newPage()
  const mobileErrors = []
  mp.on('pageerror',error=>mobileErrors.push(error.message))
  mp.on('response',response=>{if(response.url().includes('/api/')) console.log('MOBILE_API', response.request().method(), response.status(), response.url())})
  mp.on('console',msg=>{if(msg.type()==='error')console.log('MOBILE_CONSOLE_ERROR',msg.text())})
  await run('Mobile-width welcome screen and browser form', async () => {
    await mp.goto(ROOT + '/', {waitUntil:'domcontentloaded'})
    await mp.getByRole('heading',{name:'Start your family story'}).waitFor({timeout:15000})
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    assert.ok(overflow <= 8, 'Horizontal overflow: ' + overflow)
    await mp.getByPlaceholder('Tree name, e.g. The Novak Family').fill('QA mobile tree')
    await mp.getByRole('button',{name:'Create family tree'}).click()
    try { await mp.waitForFunction(() => /^\/trees\/[0-9a-f-]{36}$/.test(location.pathname), null, {timeout:15000}) } catch(error) { console.log('CREATE_TREE_MOBILE_DIAGNOSTIC', JSON.stringify({url:mp.url(),body:(await mp.locator('body').innerText()).slice(0,1200)})); throw error }
  })
  await run('Mobile-width tree and menu interaction', async () => {
    await mp.getByRole('heading',{name:'Your tree is ready'}).waitFor({timeout:15000})
    await mp.getByRole('button',{name:'Open menu'}).click()
    await mp.getByRole('button',{name:'Close menu'}).waitFor()
    await mp.keyboard.press('Escape')
  })
  await run('Mobile browser console free from uncaught exceptions', async () => {
    assert.deepEqual(mobileErrors,[])
  })
  await mobile.close()
} finally {
  await browser.close()
}
console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results},null,2))
if(results.some(x=>x.status==='FAIL'))process.exitCode=1
