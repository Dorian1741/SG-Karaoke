import { expect, test } from '@playwright/test'

import { login, navigate, openMenu } from './helpers'

test.beforeAll(() => {
  if (!process.env.E2E_PASSWORD)
    throw new Error(
      'Defina E2E_PASSWORD y ejecute E2ETestSeeder únicamente en karaokeos_test.',
    )
})

test('login, sucursal, sala, tarifa e historial, desactivación y logout', async ({
  page,
}) => {
  const suffix = `${Date.now()}`
  const branchName = `Sucursal E2E ${suffix}`
  const roomName = `Sala E2E ${suffix}`
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page)
  const cookies = await page.context().cookies()
  expect(
    cookies.some(
      (cookie) =>
        /[-_]session$/.test(cookie.name) &&
        cookie.httpOnly &&
        cookie.sameSite === 'Lax',
    ),
  ).toBeTruthy()
  await navigate(page, 'Sucursales')
  await page.getByRole('button', { name: '+ Nueva sucursal' }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Nombre', { exact: true })
    .fill(branchName)
  await page.getByLabel('Dirección').fill('Dirección de prueba')
  await page
    .getByRole('button', { name: 'Crear sucursal', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByLabel('Buscar por nombre', { exact: true }).fill(branchName)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(
    page.getByRole('cell', { name: branchName, exact: true }),
  ).toBeVisible()
  await navigate(page, 'Salas')
  await page.getByRole('button', { name: '+ Nueva sala' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre', { exact: true }).fill(roomName)
  await dialog
    .getByLabel('Sucursal', { exact: true })
    .selectOption({ label: branchName })
  await dialog.getByLabel('Capacidad').fill('8')
  await dialog.getByRole('button', { name: 'Crear sala', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByLabel('Buscar por nombre', { exact: true }).fill(roomName)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(
    page.getByRole('cell', { name: roomName, exact: true }),
  ).toBeVisible()
  await navigate(page, 'Precios por hora')
  await page.getByRole('button', { name: '+ Nuevo precio' }).click()
  await dialog
    .getByLabel('Sala', { exact: true })
    .selectOption({ label: `${roomName} · ${branchName}` })
  await dialog.getByLabel('Precio por hora').fill('20,00')
  page.once('dialog', (confirmation) => confirmation.accept())
  await dialog.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(dialog).not.toBeVisible()
  await page
    .getByLabel('Filtrar por sala')
    .selectOption({ label: `${roomName} · ${branchName}` })
  const rateRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: /20\.00 USD$/ }) })
  await rateRow.getByRole('button', { name: 'Cambiar precio' }).click()
  await dialog.getByLabel('Precio por hora').fill('25,50')
  page.once('dialog', (confirmation) => confirmation.accept())
  await dialog.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('cell', { name: /20\.00 USD$/ })).toBeVisible()
  await expect(page.getByRole('cell', { name: /25\.50 USD$/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cambiar precio' }),
  ).toHaveCount(1)
  await navigate(page, 'Salas')
  await page.getByLabel('Buscar por nombre', { exact: true }).fill(roomName)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page
    .getByRole('row')
    .filter({ hasText: roomName })
    .getByRole('button', { name: 'Desactivar' })
    .click()
  await page
    .getByRole('dialog', { name: 'Desactivar sala' })
    .getByRole('button', { name: 'Desactivar', exact: true })
    .click()
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: roomName })
      .getByText('Inactivo', { exact: true }),
  ).toBeVisible()
  await navigate(page, 'Mi negocio y equipo')
  await expect(page.getByRole('heading', { name: 'Mi equipo' })).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'e2e-owner@example.test' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: `test-results/administration-${test.info().project.name}.png`,
    fullPage: true,
  })
  await openMenu(page)
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bienvenido de nuevo' }),
  ).toBeVisible()
  await page.goto('/rooms')
  await expect(
    page.getByRole('heading', { name: 'Bienvenido de nuevo' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('CSRF rechaza solicitudes sin token ni origen verificado y maneja sesiones expiradas', async ({
  page,
}) => {
  await login(page)
  const response = await page.context().request.post('/api/v1/branches', {
    headers: {
      Accept: 'application/json',
      Origin: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
      'Sec-Fetch-Site': 'cross-site',
    },
    data: { name: 'CSRF attack' },
  })
  expect(response.status()).toBe(419)
  await page.context().clearCookies()
  await navigate(page, 'Salas')
  await expect(
    page.getByRole('heading', { name: 'Bienvenido de nuevo' }),
  ).toBeVisible()
})
