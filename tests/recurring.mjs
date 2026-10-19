import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const base = `http://127.0.0.1:${process.env.SMOKE_PORT || '4173'}/`
try {
  await page.clock.install({ time: new Date('2026-10-19T15:00:00Z') })
  await page.goto(base)
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('button', { name: 'Novo objetivo' }).click()
  await page.getByPlaceholder('Ex.: Ir à academia 20 vezes').fill('Beber 4 L por dia')
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-21')
  await page.locator('.modal-form label').filter({ hasText: 'Repetição' }).locator('select').selectOption('daily')
  await page.getByLabel('Começar em', { exact: true }).fill('2026-10-19')
  await page.getByLabel('Meta por dia', { exact: true }).fill('4')
  await page.getByLabel('Unidade', { exact: true }).fill('L')
  await page.getByLabel('Multa por ocorrência não cumprida (R$)', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Criar objetivo' }).click()
  await page.getByRole('button', { name: /Beber 4 L por dia/ }).click()
  await page.getByRole('button', { name: 'Registrar progresso' }).click()
  await page.getByRole('button', { name: 'Salvar progresso' }).click()
  assert.match(await page.locator('.big-progress').innerText(), /1\s*\/\s*3 ocorrências/)
  await page.clock.setFixedTime(new Date('2026-10-21T15:00:00Z'))
  await page.getByRole('button', { name: 'Objetivos' }).first().click()
  await page.getByRole('button', { name: /Beber 4 L por dia/ }).click()
  await page.getByText('Dia 20/10/2026').waitFor()
  await page.getByText('Pendente:').waitFor()
  await page.getByRole('button', { name: 'Marcar paga' }).click()
  await page.getByText('Pagamento marcado como feito').waitFor()
  assert.deepEqual(errors, [])
  console.log('Recurring flow passed: daily quota, missed day, per-occurrence fine and manual payment')
} finally { await browser.close() }
