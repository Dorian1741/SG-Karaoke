# KaraokeOS

Fundamentos SaaS para administrar empresas, sucursales, salas privadas de karaoke y tarifas por hora. Backend Laravel y frontend React independientes, PostgreSQL compartido con aislamiento por empresa y monolito modular.

Implementado: autenticación Sanctum con sesiones/cookies, selección autorizada de empresa, roles owner/admin/employee, CRUD con bajas lógicas, historial de tarifas, dashboard con datos reales y panel responsive. No se implementan reservas, sesiones de karaoke, pagos, promociones ni hardware.

## Estructura

```text
backend/
  app/Models/                 Entidades y scope multi-tenant
  app/Http/                   Controladores API v1, Requests, Resources, Middleware
  app/Policies/               Permisos por rol y empresa
  app/Services/               Tarifas y pertenencias transaccionales
  app/Support/                Contexto de empresa por petición
  app/Console/Commands/       Aprovisionamiento privado
  database/                   Migraciones, factories y seeders protegidos
  tests/                      Autenticación, aislamiento, integridad y migración
frontend/
  src/api/                    Cliente HTTP con cookies y XSRF
  src/auth/                   Sesión y selección de empresa
  src/components/             Componentes reutilizables
  src/pages/                  Login, dashboard y administración
  e2e/                        Pruebas Chrome de escritorio y móvil
compose.yaml                  PostgreSQL con almacenamiento persistente
docs/                         Arquitectura, base de datos, API y desarrollo
```

## Requisitos e instalación

PHP 8.3+ con extensiones Laravel y pdo_pgsql, Composer 2, Node 20.19+ o 22.12+, npm, Git, Docker Engine y Docker Compose v2. Versiones/dependencias verificadas en [desarrollo](docs/development.md). No se necesitan herramientas globales Laravel/Vite.

Copiar únicamente archivos que aún no existan:

```sh
cp -n .env.example .env
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

Definir la misma contraseña local en POSTGRES_PASSWORD (raíz) y DB_PASSWORD (backend). Los ejemplos no incluyen secretos; los .env locales ya existentes se conservaron. POSTGRES_DB/USER/PORT deben coincidir con DB_DATABASE/USERNAME/PORT; Laravel corre en el host con DB_HOST=127.0.0.1.

```sh
docker compose config --quiet
docker compose up -d --wait postgres
cd backend
composer install
php artisan key:generate
php artisan migrate
php artisan karaokeos:provision "Mi bar" mi-bar owner@example.com
cd ../frontend
npm ci
```

Generar APP_KEY únicamente en una instalación nueva. `composer setup` instala dependencias/copia el entorno sin regenerar claves ni ejecutar migraciones forzadas. Aprovisionamiento solicita contraseña oculta (mínimo 12 caracteres, mayúsculas, minúsculas y números); no hay contraseña ni usuario predeterminados. El seeder general tampoco crea cuentas de demostración.

Antes de migrar una base existente: respaldo y ensayo. La migración nueva convierte IDs de usuarios y referencias de sesión a UUID conservando registros; no tiene reversión automática. No usar `migrate:fresh` en una base de aplicación. Más detalles en [base de datos](docs/database.md).

## Ejecución

Terminal backend:

```sh
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```

Terminal frontend:

```sh
cd frontend
npm run dev
```

Abrir http://127.0.0.1:5173, entrar con la cuenta aprovisionada y elegir establecimiento si hay varios. React está directamente en frontend/, sin carpeta anidada. Vite reenvía `/api` y `/sanctum` al backend; mantener el mismo host para cookies. Las variables VITE_* son públicas.

La página http://127.0.0.1:5173/health conserva la comprobación inicial. `GET /api/v1/health` responde 200 con `database=connected` o 503 con `database=unavailable`. Endpoints, códigos, filtros y roles en [contrato API](docs/api.md).

Detener PostgreSQL con `docker compose down`; el volumen conserva los datos. Cambiar la contraseña de .env no cambia la de un volumen inicializado.

## Pruebas

Crear una base independiente una sola vez:

```sh
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" karaokeos_test'
cd backend
php artisan test --compact
composer validate --strict
composer check-platform-reqs
composer audit
vendor/bin/pint --format agent
cd ../frontend
npm run lint
npm run build
npm audit
```

PHPUnit fija karaokeos_test y comprueba el nombre real antes de reconstruir el esquema. Sin PostgreSQL: `php artisan test --compact --exclude-group=integration`. Para navegador, usar Chrome y seguir la preparación de fixtures/contraseña en [desarrollo](docs/development.md), después ejecutar `npm run test:e2e`. Nunca ejecutar ambas suites simultáneamente sobre esa base.

## Seguridad y decisiones

[Arquitectura](docs/architecture.md) documenta tenant/contexto, permisos y CSRF. Sesión HttpOnly y SameSite=Lax; selección de empresa validada en el servidor, scopes obligatorios y claves compuestas; bajas lógicas; dinero NUMERIC(12,2) expuesto como cadena; una única tarifa vigente y conservación del historial.

Producción requiere HTTPS, APP_ENV=production, APP_DEBUG=false, SESSION_SECURE_COOKIE=true, orígenes autorizados, rol PostgreSQL con permisos mínimos, respaldos y servidor web con raíz backend/public. Servir el build React con fallback index.html y proxy para `/api` y `/sanctum`. No usar servidores de desarrollo en producción.

## Validación y pendientes del entorno

Docker Compose no está instalado y el motor no está disponible: el arranque real del contenedor sigue pendiente. Las migraciones y pruebas se ejecutan con PostgreSQL temporal local en puerto 55432, exclusivamente en karaokeos_test, sin migrar bases existentes.

Git está inicializado localmente; no se añadieron archivos ni se crearon commits. Los .env, dependencias, build y reportes E2E están excluidos. No hay secretos versionados.

Validación del 9 de noviembre de 2026: PHPUnit 27/27 pruebas y 134 aserciones sobre PostgreSQL real; Playwright Chrome 4/4 pruebas en escritorio y móvil; Pint, Composer validate/check-platform-reqs, frontend lint y build correctos. Composer audit y npm audit no reportan vulnerabilidades conocidas. Se comprobó sintaxis YAML de Compose, sin ejecutar contenedores. Los servidores y PostgreSQL temporales se detuvieron al finalizar.

## Acceso manual de demostración

Para la exploración solicitada posteriormente, `backend/.env` apunta ahora a `karaokeos_demo` en `127.0.0.1:55432`. Es una copia independiente de la base de pruebas, con el propietario `e2e-owner@example.test`; la contraseña se entrega por separado y no se guarda en la documentación. La configuración anterior se conservó en `backend/.env.before-demo`, excluida de Git.

Abrir http://127.0.0.1:5173/login. Se comprobó el login y el acceso a dashboard, sucursales, salas, tarifas y administración; los servidores quedaron encendidos para explorar. Esta base no debe usarse para las pruebas automáticas, que continúan apuntando exclusivamente a `karaokeos_test`. Detalles de reinicio en [desarrollo](docs/development.md).

## Uso del panel

- **Inicio** presenta el resumen real y una guía para empezar: sucursales, salas y precios.
- **Sucursales** administra las ubicaciones del negocio; **Salas** muestra su capacidad y disponibilidad.
- **Precios por hora** permite consultar el precio vigente, cambiarlo y ver el historial. Acepta importes como `20,50` o `20.50`.
- **Mi negocio y equipo** reúne los datos del establecimiento y los permisos de cada persona.
- En móvil, el botón **Menú** muestra todas las opciones. Los listados se presentan como tarjetas y los formularios incluyen ayuda, errores junto a los campos y confirmación al guardar.

La mejora de usabilidad se verificó con 10 pruebas Chrome de escritorio/móvil, incluyendo teclado, foco de formularios, mensajes de error y reintentos. Lint y build correctos, sin dependencias nuevas de aplicación.

## Eliminar, restaurar y volver a activar

Sucursales, Salas, Precios por hora y Mi negocio y equipo incorporan botones **Eliminar** y una vista **Papelera**. La eliminación conserva los datos y permite restaurarlos. Las sucursales con salas no eliminadas quedan protegidas; al eliminar una sala se desactiva su precio vigente y se conserva el historial.

Las sucursales y salas restauradas vuelven inactivas; pueden recuperarse con **Activar**. Los precios restaurados vuelven al historial. En el equipo, restaurar una persona no habilita su acceso automáticamente y el último propietario activo está protegido.

La nueva migración se aplica con `cd backend` y `php artisan migrate`. Ya está aplicada a la demostración local, con respaldo previo. Los nuevos contratos están en [API](docs/api.md) y las reglas en [arquitectura](docs/architecture.md).

Validación de estas reglas: 41 pruebas backend (232 aserciones), 18 pruebas Chrome de escritorio/móvil, Pint, lint y build correctos. También se corrigieron respuestas 500 de autenticación y el login de correos antiguos con mayúsculas. La demostración sigue disponible con las mismas credenciales.
