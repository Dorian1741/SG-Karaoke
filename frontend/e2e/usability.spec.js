import { expect, test } from '@playwright/test'
import { login, navigate, openMenu } from './helpers'

test('contraseña visible, menú completo y navegación por teclado', async ({
  page,
}) => {
  await page.goto('/login')
  const password = page.getByLabel('Contraseña', { exact: true })
  await password.fill('Texto de prueba')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await login(page)
  await expect(page.getByRole('heading', { name: 'Todo a mano' })).toBeVisible()
  await navigate(page, 'Precios por hora')
  await expect(
    page.getByRole('heading', { name: 'Precios por hora', exact: true }),
  ).toBeVisible()
  await expect(page.locator('#main-content')).toBeFocused()
  const skip = page.getByRole('link', { name: 'Saltar al contenido' })
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await openMenu(page)
  await expect(
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link'),
  ).toHaveCount(5)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
})

test('los errores de formulario orientan al campo y permiten cancelar', async ({
  page,
}) => {
  await login(page)
  await navigate(page, 'Sucursales')
  await page.getByRole('button', { name: '+ Nueva sucursal' }).click()
  const modal = page.getByRole('dialog')
  const name = modal.getByLabel('Nombre', { exact: true })
  await expect(name).toBeFocused()
  await name.fill('Mi local')
  await page.route('**/api/v1/branches', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Validation failed',
            errors: { name: ['The name field is required.'] },
          }),
        })
      : route.continue(),
  )
  await modal
    .getByRole('button', { name: 'Crear sucursal', exact: true })
    .click()
  await expect(modal.getByRole('alert')).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveValue('Mi local')
  await modal.getByRole('button', { name: 'Completa el campo nombre.' }).click()
  await expect(name).toBeFocused()
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(modal).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: '+ Nueva sucursal' }),
  ).toBeFocused()
})

test('un error al cargar el equipo termina la espera y ofrece reintento', async ({
  page,
}) => {
  await login(page)
  await page.route('**/api/v1/members?**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Database internal details' }),
    }),
  )
  await navigate(page, 'Mi negocio y equipo')
  await expect(page.getByRole('alert')).toContainText(
    'No pudimos completar la operación',
  )
  await expect(page.getByText('Cargando tu equipo…')).not.toBeVisible()
  await expect(page.getByText('Database internal details')).not.toBeVisible()
  await page.unroute('**/api/v1/members?**')
  await page.getByRole('button', { name: 'Volver a cargar el equipo' }).click()
  await expect(
    page.getByRole('cell', { name: 'e2e-owner@example.test' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).not.toBeVisible()
  await page.screenshot({
    path: `test-results/usability-${test.info().project.name}.png`,
    fullPage: true,
  })
})
