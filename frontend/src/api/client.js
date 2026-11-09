const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
  /\/$/,
  '',
)

const fieldNames = {
  name: 'nombre',
  email: 'correo electrónico',
  password: 'contraseña',
  branch_id: 'sucursal',
  room_id: 'sala',
  capacity: 'capacidad',
  operational_status: 'estado de la sala',
  hourly_price: 'precio por hora',
  currency: 'moneda',
  role: 'permisos',
  timezone: 'zona horaria',
}

function readableValidation(errors = {}) {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      messages.map((message) => {
        if (!/^(The |This |These )/.test(message)) return message
        const label = fieldNames[field] || 'este campo'
        if (message.includes('required')) return `Completa el campo ${label}.`
        if (field === 'email') return 'Escribe un correo electrónico válido.'
        if (field === 'capacity')
          return 'La capacidad debe ser un número entero entre 1 y 10000.'
        if (field === 'hourly_price')
          return 'Escribe un precio no negativo con un máximo de dos decimales, por ejemplo 20.00.'
        if (field === 'password')
          return 'Usa al menos 12 caracteres, con mayúsculas, minúsculas y números.'
        if (field === 'branch_id' || field === 'room_id')
          return `Elige una ${label} activa de tu establecimiento.`
        if (message.includes('greater than') || message.includes('characters'))
          return `El campo ${label} es demasiado largo. Acorta el texto e intenta de nuevo.`
        return `Revisa el campo ${label} y vuelve a intentarlo.`
      }),
    ]),
  )
}

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

function csrfToken() {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

export async function request(
  path,
  { method = 'GET', body, signal, raw = false, quiet = false } = {},
) {
  let response
  try {
    response = await fetch(raw ? path : `${baseUrl}${path}`, {
      method,
      credentials: 'include',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-XSRF-TOKEN': csrfToken() } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(
      'No se pudo conectar con el servidor. Comprueba tu conexión e intenta nuevamente.',
      0,
    )
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (!quiet && [401, 419].includes(response.status)) {
      window.dispatchEvent(
        new CustomEvent('auth-expired', { detail: response.status }),
      )
    }
    const message =
      response.status === 419
        ? 'La sesión expiró. Inicia sesión nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para esta operación o el establecimiento ya no está autorizado.'
          : response.status === 404
            ? 'El recurso no existe o no está disponible para tu establecimiento.'
            : response.status >= 500
              ? 'No pudimos completar la operación. Intenta nuevamente en un momento.'
              : response.status === 422
                ? 'Revisa los campos indicados para continuar.'
                : response.status === 429
                  ? 'Has hecho varios intentos. Espera un momento antes de volver a intentar.'
                  : data.message || 'No pudimos completar la operación.'
    throw new ApiError(
      message,
      response.status,
      readableValidation(data.errors),
    )
  }
  return data
}

export function csrf() {
  return request('/sanctum/csrf-cookie', { raw: true, quiet: true })
}

export async function getOptions(path, signal) {
  const records = []
  let page = 1
  let lastPage = 1
  do {
    const result = await request(`${path}?per_page=100&page=${page}`, {
      signal,
    })
    records.push(...result.data)
    lastPage = result.meta.last_page
    page++
  } while (page <= lastPage)
  return records
}
