import { expect } from '@playwright/test'

export async function login(page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('e2e-owner@example.test')
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill(process.env.E2E_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(
    page.getByRole('heading', { name: 'Inicio', exact: true }),
  ).toBeVisible()
}

export async function openMenu(page) {
  const toggle = page.getByRole('button', { name: 'Menú', exact: true })
  if (await toggle.isVisible()) await toggle.click()
}

export async function navigate(page, name) {
  await openMenu(page)
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name, exact: false })
    .click()
}
