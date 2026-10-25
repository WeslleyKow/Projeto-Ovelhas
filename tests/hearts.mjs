import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const base = `http://127.0.0.1:${process.env.SMOKE_PORT || '4173'}/`
try {
  await page.clock.install({ time: new Date('2026-10-24T15:00:00Z') })
  await page.goto(base)
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('button', { name: 'Objetivos' }).first().click()
  for (const title of ['Água de ontem', 'Leitura de ontem', 'Treino de ontem']) {
    await page.getByRole('button', { name: 'Novo objetivo' }).click()
    await page.getByPlaceholder('Ex.: Ir à academia 20 vezes').fill(title)
    await page.getByLabel('Data final', { exact: true }).fill('2026-10-27')
    await page.locator('.modal-form label').filter({ hasText: 'Repetição' }).locator('select').selectOption('daily')
    await page.getByLabel('Meta por dia', { exact: true }).fill('1')
    await page.getByLabel('Unidade', { exact: true }).fill('vez')
    await page.getByRole('button', { name: 'Criar objetivo' }).click()
  }
  await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'))
  await page.getByRole('button', { name: 'Vidas', exact: true }).click()
  await page.getByRole('heading', { name: 'Suas vidas' }).waitFor()
  await page.locator('.heart-goal').filter({ hasText: 'Água de ontem' }).getByRole('checkbox').check()
  await page.locator('.heart-goal').filter({ hasText: 'Leitura de ontem' }).getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Usar 1 coração e recuperar' }).click()
  await page.getByText('2 de 3').waitFor()
  await page.getByText('Você já gastou um coração por ontem.').waitFor()
  await page.locator('.heart-goal').filter({ hasText: 'Treino de ontem' }).getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Completar recuperação de ontem' }).click()
  assert.equal(await page.locator('.heart-balance strong').innerText(), '2 de 3', 'continuing the same day uses no second heart')
  await page.getByRole('button', { name: 'Checkouts', exact: true }).first().click()
  await page.getByLabel('Participante').selectOption({ label: 'Você' })
  for (const title of ['Água de ontem', 'Leitura de ontem', 'Treino de ontem']) {
    const card = page.locator('.checkout-card').filter({ hasText: title })
    await card.getByText('Ocorrência: 24 de out. de 2026').waitFor()
    await card.getByText('Marcado em 25/10/2026 às 12:00 (Brasília)').waitFor()
  }
  await page.reload()
  await page.getByRole('button', { name: 'Explorar demonstração' }).click()
  await page.getByRole('button', { name: 'Vidas', exact: true }).click()
  assert.equal(await page.locator('.heart-balance strong').innerText(), '2 de 3', 'heart spend persists after reload')
  assert.deepEqual(errors, [])
  console.log('Hearts flow passed: one heart recovers several goals from yesterday and restores after 30 days')
} finally { await browser.close() }
