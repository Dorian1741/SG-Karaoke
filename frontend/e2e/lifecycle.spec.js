import { expect, test } from '@playwright/test'
import { login, navigate } from './helpers'

async function api(page, path, method = 'GET', body) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const cookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith('XSRF-TOKEN='))
      const response = await fetch(`/api/v1${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': cookie
            ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
            : '',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      return {
        status: response.status,
        body: response.status === 204 ? null : await response.json(),
      }
    },
    { path, method, body },
  )
}

async function createRoom(page) {
  const name = `Papelera E2E ${Date.now()}`
  const branch = await api(page, '/branches', 'POST', { name })
  expect(branch.status).toBe(201)
  const room = await api(page, '/rooms', 'POST', {
    name: `Sala ${name}`,
    branch_id: branch.body.data.id,
    capacity: 4,
  })
  expect(room.status).toBe(201)
  return { branch: branch.body.data, room: room.body.data }
}

async function search(page, name) {
  await page.getByLabel('Buscar por nombre', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
}

async function trashView(page, trashed) {
  await page
    .getByRole('group', { name: 'Vista del listado' })
    .getByRole('button', {
      name: trashed ? 'Papelera' : 'Listado',
      exact: true,
    })
    .click()
}

async function confirmDelete(page) {
  const modal = page.getByRole('dialog')
  await expect(
    modal.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await modal
    .getByRole('button', { name: 'Enviar a la papelera', exact: true })
    .click()
  await expect(modal).not.toBeVisible()
}

test('eliminar y restaurar una sucursal conserva datos y funciona con teclado', async ({
  page,
}) => {
  await login(page)
  const name = `Sucursal eliminable ${Date.now()}`
  const created = await api(page, '/branches', 'POST', { name })
  expect(created.status).toBe(201)
  const forgedDelete = await page
    .context()
    .request.delete(`/api/v1/branches/${created.body.data.id}`, {
      headers: {
        Accept: 'application/json',
        Origin: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
  expect(forgedDelete.status()).toBe(419)
  await navigate(page, 'Sucursales')
  let row = await search(page, name)
  await row
    .getByRole('button', { name: `Eliminar ${name}`, exact: true })
    .click()
  const modal = page.getByRole('dialog', { name: 'Eliminar sucursal' })
  await expect(
    modal.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await expect(
    row.getByRole('button', { name: `Eliminar ${name}`, exact: true }),
  ).toBeFocused()
  await row
    .getByRole('button', { name: `Eliminar ${name}`, exact: true })
    .click()
  await page.keyboard.press('Tab')
  await expect(
    modal.getByRole('button', { name: 'Enviar a la papelera' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(modal).not.toBeVisible()
  await expect(page.getByRole('cell', { name, exact: true })).not.toBeVisible()
  await expect(page.locator('#main-content')).toBeFocused()
  await trashView(page, true)
  row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
  await row
    .getByRole('button', { name: `Restaurar ${name}`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Restaurar', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await trashView(page, false)
  row = await search(page, name)
  await expect(row.getByText('Inactivo', { exact: true })).toBeVisible()
  await row
    .getByRole('button', { name: `Activar ${name}`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Activar', exact: true })
    .click()
  await expect(row.getByText('Activo', { exact: true })).toBeVisible()
})

test('una sucursal con salas explica el conflicto y eliminar una sala conserva el precio', async ({
  page,
}) => {
  await login(page)
  const { branch, room } = await createRoom(page)
  const price = await api(page, `/rooms/${room.id}/rates`, 'POST', {
    name: `Precio ${room.name}`,
    hourly_price: '18.50',
    currency: 'USD',
  })
  expect(price.status).toBe(201)
  await navigate(page, 'Sucursales')
  const branchRow = await search(page, branch.name)
  await branchRow
    .getByRole('button', { name: `Eliminar ${branch.name}`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Enviar a la papelera' })
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'todavía tiene salas',
  )
  await expect(page.getByRole('dialog').getByRole('alert')).toBeFocused()
  await page.keyboard.press('Escape')
  await navigate(page, 'Salas')
  const roomRow = await search(page, room.name)
  await roomRow
    .getByRole('button', { name: `Eliminar ${room.name}`, exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'su historial de precios',
  )
  await confirmDelete(page)
  const history = await api(page, `/rates?room_id=${room.id}`)
  expect(history.status).toBe(200)
  expect(history.body.data[0].hourly_price).toBe('18.50')
  expect(history.body.data[0].is_active).toBe(false)
  await trashView(page, true)
  await expect(
    page.getByRole('cell', { name: room.name, exact: true }),
  ).toBeVisible()
})

test('restaurar un precio conserva el nuevo precio vigente', async ({
  page,
}) => {
  await login(page)
  const { room, branch } = await createRoom(page)
  const name = `Precio histórico ${Date.now()}`
  expect(
    (
      await api(page, `/rooms/${room.id}/rates`, 'POST', {
        name,
        hourly_price: '12.00',
        currency: 'USD',
      })
    ).status,
  ).toBe(201)
  await navigate(page, 'Precios por hora')
  await page
    .getByLabel('Filtrar por sala')
    .selectOption({ label: `${room.name} · ${branch.name}` })
  let row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
  await row
    .getByRole('button', { name: `Eliminar ${name}`, exact: true })
    .click()
  await confirmDelete(page)
  expect(
    (
      await api(page, `/rooms/${room.id}/rates`, 'POST', {
        name: 'Nuevo precio',
        hourly_price: '15.00',
        currency: 'USD',
      })
    ).status,
  ).toBe(201)
  await trashView(page, true)
  row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
  await row
    .getByRole('button', { name: `Restaurar ${name}`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Restaurar', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await trashView(page, false)
  await page
    .getByLabel('Filtrar por sala')
    .selectOption({ label: `${room.name} · ${branch.name}` })
  await expect(page.getByText('Vigente', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Anterior', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('cell', { name: /15\.00 USD$/ })).toBeVisible()
  await expect(page.getByRole('cell', { name: /12\.00 USD$/ })).toBeVisible()
})

test('el equipo protege al último propietario y permite restaurar una pertenencia sin acceso', async ({
  page,
}) => {
  await login(page)
  const name = `A Equipo ${Date.now()}`
  const member = await api(page, '/members', 'POST', {
    name,
    email: `member-${Date.now()}@example.test`,
    password: 'TemporaryTestPassword123!',
    role: 'employee',
  })
  expect(member.status).toBe(201)
  await navigate(page, 'Mi negocio y equipo')
  let owner = page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', {
        name: 'e2e-owner@example.test',
        exact: false,
      }),
    })
  await owner
    .getByRole('button', { name: 'Eliminar Propietario E2E', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Enviar a la papelera' })
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'propietario activo',
  )
  await page.keyboard.press('Escape')
  let row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
  await row
    .getByRole('button', { name: `Eliminar ${name}`, exact: true })
    .click()
  await confirmDelete(page)
  await trashView(page, true)
  row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
  await row
    .getByRole('button', { name: `Restaurar ${name}`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Restaurar', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await trashView(page, false)
  row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) })
  await expect(row.getByText('Sin acceso', { exact: true })).toBeVisible()
})
