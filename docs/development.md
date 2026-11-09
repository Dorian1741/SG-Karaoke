# Desarrollo y pruebas

## Dependencias

Backend: PHP 8.3+ (instalado 8.5.9), Composer 2, Laravel 13.40.0, Sanctum 4.3.3. Frontend: Node 20.19+ o 22.12+ (instalado 22.22.2), React 19.3.1, Vite 8.3.6, Tailwind/@tailwindcss-vite 4.3.5, React Router DOM 7.18.5. Playwright 1.65.0 es exclusivamente de desarrollo; su configuración usa Chrome instalado, sin descargas globales. Los lockfiles fijan versiones reproducibles.

## Variables

- Raíz `.env`: COMPOSE_PROJECT_NAME, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_PORT.
- `backend/.env`: APP_KEY, APP_ENV, APP_DEBUG, APP_URL, DB_CONNECTION=pgsql, DB_HOST/PORT/DATABASE/USERNAME/PASSWORD, FRONTEND_URL, SANCTUM_STATEFUL_DOMAINS, SESSION_DRIVER, SESSION_SECURE_COOKIE, SESSION_HTTP_ONLY, SESSION_SAME_SITE, CACHE_STORE.
- `frontend/.env`: VITE_API_BASE_URL=/api/v1 y API_PROXY_TARGET=http://127.0.0.1:8000. Solo VITE_* se expone en el build: nunca colocar secretos ahí.
- Pruebas: DB_PORT/DB_HOST/DB_USERNAME/DB_PASSWORD según la instancia y DB_DATABASE=karaokeos_test, fijado por PHPUnit. E2E_PASSWORD se transmite como variable de proceso, sin valor predeterminado y sin guardarla en Git.

Los ejemplos son para desarrollo HTTP local. En producción configurar APP_ENV=production, APP_DEBUG=false y SESSION_SECURE_COOKIE=true, HTTPS y orígenes explícitos. No mezclar localhost y 127.0.0.1 en la navegación: las cookies pertenecen a un host.

## Preparación

Seguir README. Las claves se generan una sola vez. El comando privado `php artisan karaokeos:provision "Mi bar" mi-bar owner@example.com` solicita contraseña de forma oculta, no acepta una contraseña en argumentos y no crea cuentas predeterminadas. Puede asociar una identidad existente como propietario sin alterar sus credenciales. `db:seed` general no crea usuarios de demostración.

## Suite backend

Crear una base independiente, una sola vez:

```sh
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" karaokeos_test'
cd backend
php artisan test --compact
```

La suite verifica el nombre real de la base antes de reconstruirla. No usar credenciales productivas en este proceso. Si el puerto es distinto, por ejemplo PostgreSQL temporal local: `DB_PORT=55432 php artisan test --compact`.

Para pruebas sin infraestructura: `php artisan test --compact --exclude-group=integration`.

## Navegador

Usar exclusivamente karaokeos_test. Tras terminar PHPUnit, cargar fixtures E2E con contraseña elegida localmente. En una terminal compatible con bash/zsh:

```sh
read -r -s E2E_PASSWORD
export E2E_PASSWORD
cd backend
APP_ENV=testing DB_DATABASE=karaokeos_test php artisan db:seed --class=E2ETestSeeder
DB_DATABASE=karaokeos_test php artisan serve --host=127.0.0.1 --port=8000
```

En otra terminal ejecutar Vite desde frontend. En la terminal de pruebas exportar la misma E2E_PASSWORD (sin escribir su valor en comandos/historial) y ejecutar desde frontend:

```sh
npm run test:e2e
```

El fixture es e2e-owner@example.test, creado solo en la base de pruebas. La contraseña no está en el código. Tests crean registros identificados como E2E; no usar fixtures como datos de negocio. Las pruebas cubren escritorio/móvil, login, cookie HttpOnly/SameSite, sucursal, sala, tarifa, reemplazo e historial, desactivación, logout, rutas privadas, rechazo de CSRF sin origen verificado y expiración de sesión. Los reportes/capturas están en `frontend/test-results`, excluidos de Git.

Para puertos alternativos, configurar E2E_BASE_URL en Playwright y SANCTUM_STATEFUL_DOMAINS/FRONTEND_URL en Laravel, además de API_PROXY_TARGET en Vite. No ejecutar PHPUnit mientras el navegador usa esa base.

## Calidad

```sh
cd backend
composer validate --strict
composer check-platform-reqs
composer audit
vendor/bin/pint --format agent
cd ../frontend
npm run lint
npm run build
npm audit
```

El servidor de producción debe servir el build, devolver index.html en rutas React y reenviar `/api` y `/sanctum` a Laravel. No almacenar en caché las respuestas autenticadas. En Laravel usar configuración/rutas cacheadas y autoloader optimizado tras ajustar el entorno; no cachear configuración durante las pruebas.

## Limitaciones de este entorno

Docker Compose no está instalado y el motor no está disponible. Se valida PostgreSQL usando una instancia temporal instalada en el host, puerto 55432, sin alterar la configuración de aplicación. El arranque real del contenedor sigue pendiente. Git fue inicializado sin commits ni archivos añadidos; los secretos, vendor, node_modules y reportes están excluidos.

## Resultados comprobados — 9 de noviembre de 2026

- PostgreSQL temporal real, base separada karaokeos_test: 27 pruebas backend aprobadas, 134 aserciones.
- Migraciones ejecutadas en pruebas; ensayo adicional de conversión UUID con usuario/sesión anteriores y verificación de datos conservados.
- Chrome headless: 4 pruebas aprobadas (dos flujos, escritorio/móvil), sin errores JavaScript en el recorrido administrativo.
- Lint sin advertencias, build correcto: JavaScript 284,77 kB / 89,09 kB gzip; CSS 13,25 kB / 4,02 kB gzip.
- Pint, composer validate y requisitos de plataforma correctos; auditorías npm/Composer sin vulnerabilidades conocidas.
- Se corrigieron etiquetas accesibles de selects y CSS global heredado durante pruebas visuales; las pruebas CSRF siguen el comportamiento oficial de Laravel 13.
- Git inicializado sin commits; check-ignore confirmó exclusiones de .env, vendor, node_modules y test-results. Permisos de .env locales restringidos a 600.
- Docker Compose: solo sintaxis YAML verificada. Arranque real pendiente por infraestructura no disponible.
- Procesos Laravel/Vite/PostgreSQL temporales detenidos al finalizar. No se migró la base de aplicación ni se crearon cuentas de negocio reales.

## Demostración manual habilitada después de la revisión

La conexión de aplicación anterior rechazaba la contraseña PostgreSQL. Para permitir explorar el sistema se creó `karaokeos_demo` como copia de `karaokeos_test` en la instancia local del puerto 55432. La base original y las credenciales del propietario se conservaron. `backend/.env.before-demo` guarda la configuración anterior con permisos 600 y está excluido de Git.

El backend usa ahora `DB_HOST=127.0.0.1`, `DB_PORT=55432` y `DB_DATABASE=karaokeos_demo`. React y Laravel mantienen los puertos 5173 y 8000. No hay contraseñas nuevas en archivos de código o documentación. Se verificó en Chrome el acceso del propietario y las cinco pantallas administrativas, sin errores JavaScript y con health HTTP 200.

Si PostgreSQL de demostración está detenido, iniciarlo con las herramientas ya instaladas:

```sh
pg_ctl -D /tmp/karaokeos-pg-task001 -l /tmp/karaokeos-pg-task001.log -o '-h 127.0.0.1 -p 55432 -k /tmp' -w start
```

Después iniciar Laravel y Vite con los comandos habituales. La instancia es local y su directorio está en `/tmp`; esta preparación sirve para exploración y no sustituye un despliegue persistente. No ejecutar `migrate:fresh` sobre `karaokeos_demo`; las pruebas automáticas deben seguir usando únicamente `karaokeos_test`.

## Mejora de usabilidad y accesibilidad básica

Las rutas se mantienen; las etiquetas visibles son Inicio, Sucursales, Salas, Precios por hora y Mi negocio y equipo. Layout incorpora menú móvil desplegable, salto al contenido, títulos de documento y foco al navegar. UI centraliza campos con ayuda/errores asociados, mensajes de éxito, contraseña visible, cancelación y retorno de foco al cerrar diálogos. Los listados adaptan su presentación a tarjetas móviles conservando la estructura de tabla.

El cliente HTTP traduce validaciones comunes y evita mostrar detalles internos de errores de servidor. Administración termina el indicador de carga ante fallos y permite reintentar. El precio introducido con coma se normaliza a una cadena decimal con punto antes de enviarse a la API; no se convierte a float.

`frontend/e2e/usability.spec.js` comprueba contraseña visible, navegación, teclado, foco de errores, cancelación de formularios y recuperación de fallos. Junto al recorrido administrativo, pasaron 10 pruebas Chrome en escritorio/móvil. Lint sin advertencias y build correctos. Estas mejoras no constituyen una certificación de conformidad WCAG.

La verificación se ejecutó en la instancia aislada de revisión del puerto 55433; los datos de `karaokeos_demo` y las credenciales de acceso manual se conservaron.

## Validación de lógica de negocio, papelera y autenticación

- Backend: 41 pruebas aprobadas, 232 aserciones sobre PostgreSQL aislado en el puerto 55433. Cobertura adicional de eliminación/restauración, restricciones de padres activos, preservación de precios al mover salas, pertenencias globales, protección del último propietario y aislamiento de papelera.
- Chrome: 18 pruebas aprobadas en escritorio/móvil. Incluyen cancelar con Escape, foco inicial en Cancelar, retorno de foco, errores de conflicto, restauración inactiva y rechazo CSRF de DELETE.
- Pint, Composer validate/check-platform-reqs, lint sin advertencias y build correctos. No se añadieron dependencias de aplicación.
- Se corrigieron tres regresiones de autenticación: API sin Accept, Bearer inválido y correos antiguos en mayúsculas. EnsureApiJson y la configuración de Sanctum evitan respuestas 500 en esos casos.
- La migración adicional de papelera ya está aplicada a karaokeos_demo. Se creó un respaldo privado fuera del repositorio antes de migrar. La comprobación en el sitio del puerto 5173 fue de solo lectura; no se eliminaron registros durante esa comprobación.
- La instancia aislada y sus servidores se detuvieron al finalizar. La demostración del puerto 5173 y su PostgreSQL del puerto 55432 siguen encendidos.
