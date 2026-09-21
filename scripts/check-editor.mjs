// Isolated visual check: renders the editor without accessing Supabase or app sessions.
// node scripts/check-editor.mjs <absolute path to playwright/index.mjs>
import { createServer } from 'vite'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'isolated-editor-check',
    resolveId(id) { if (id === 'virtual:editor-check') return '\0editor-check' },
    load(id) {
      if (id !== '\0editor-check') return
      return `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { BrowserRouter } from 'react-router-dom';
        import Editor from '/src/pages/ChequeEditor.jsx';
        import '/src/styles.css';
        const Layout = ({ children }) => React.createElement('div', null, children);
        createRoot(document.getElementById('root')).render(
          React.createElement(BrowserRouter, null, React.createElement(Editor, { Layout }))
        );
      `
    },
    configureServer(vite) {
      vite.middlewares.use('/__editor_check__', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html')
        res.end(await vite.transformIndexHtml('/__editor_check__',
          '<html><body><div id="root"></div><script type="module" src="/@id/virtual:editor-check"></script></body></html>'))
      })
    },
  }],
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  await page.route('https://**.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(server.resolvedUrls.local[0] + '__editor_check__')
  await page.getByLabel('Número de cheque').fill('9264')
  await page.getByLabel('Código de comprobante').fill('404')
  await page.getByRole('radio').nth(1).check()
  await page.getByRole('button', { name: 'Comenzar a editar' }).click()
  await page.evaluate(() => document.fonts.ready)
  await page.getByLabel('Beneficiario del cheque').fill('juan manuel')
  const payeeWidths = await page.getByLabel('Beneficiario del cheque').evaluate(input => ({ input: input.getBoundingClientRect().width, text: input.previousElementSibling.getBoundingClientRect().width }))
  assert.ok(payeeWidths.input >= payeeWidths.text && payeeWidths.input <= payeeWidths.text + 8)
  await page.getByLabel('Valor de gasto 1').fill('100')
  await page.getByLabel('Objeto de gasto 1').press('Enter')
  await page.getByLabel('Valor de gasto 2').fill('20.50')
  assert.equal(await page.locator('.voucher-ledger tfoot td').last().evaluate(cell => cell.textContent), '120.50')
  await page.getByLabel('Objeto de gasto 2').hover()
  assert.equal(await page.getByLabel('Añadir otra fila de gasto').last().evaluate(button => getComputedStyle(button).opacity), '1')
  await page.getByRole('button', { name: '2', exact: true }).click()
  await page.getByLabel('DNI del beneficiario en hoja 2').fill('0501-1234-56789')
  await page.getByRole('button', { name: '3', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: 'Beneficiario en hoja 3', exact: true }).inputValue(), 'JUAN MANUEL')
  assert.equal(await page.getByRole('textbox', { name: 'DNI del beneficiario en hoja 3', exact: true }).inputValue(), '0501-1234-56789')
  await page.getByRole('button', { name: '1', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: 'DNI del beneficiario en hoja 1', exact: true }).inputValue(), '0501-1234-56789')
  await mkdir('artifacts/editor', { recursive: true })
  for (let n = 1; n <= 3; n++) {
    await page.locator('.page-controls').getByRole('button', { name: String(n), exact: true }).click()
    const sheet = page.locator('.bond-page')
    await sheet.locator('img').evaluateAll(async images => { await Promise.all(images.map(img => img.decode())) })
    await sheet.screenshot({ path: `artifacts/editor/hoja-${n}.png`, style: '.page-controls { visibility: hidden !important; }' })
    const size = await sheet.boundingBox()
    assert.equal(size.width, 816)
    assert.equal(size.height, 1056)
    const overflow = await sheet.evaluate(root => {
      const r = root.getBoundingClientRect()
      return [...root.querySelectorAll('*')].filter(el => {
        const b = el.getBoundingClientRect()
        return b.width && b.height && (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1 || b.top < r.top - 1)
      }).map(el => el.className || el.tagName)
    })
    assert.deepEqual(overflow, [], `Page ${n} outside sheet`)
  }
  await page.getByLabel('Mostrar datos de referencia').uncheck()
  assert.equal(await page.locator('.bond-page').getByText('JOSE MANUEL ROMERO ANDINO', { exact: true }).count(), 0)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal((await page.locator('.bond-page').boundingBox()).width, 816)
  await page.reload()
  await page.getByLabel('Número de cheque').fill('1000')
  await page.getByLabel('Código de comprobante').fill('500')
  await page.getByRole('button', { name: 'Comenzar a editar' }).click()
  assert.equal(await page.locator('.page-controls').getByRole('button', { name: '3', exact: true }).count(), 0)
  assert.equal(await page.locator('.bond-page').getByText('CHEQUE 1000', { exact: true }).count(), 1)
  assert.deepEqual(errors, [])
  console.log('PASS: 3 viatico pages, 2 compra pages, reference toggle, fixed Letter dimensions, no sheet overflow or React errors.')
} finally {
  await browser?.close()
  await server.close()
}
