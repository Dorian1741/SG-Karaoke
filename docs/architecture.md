# Arquitectura

KaraokeOS mantiene un backend Laravel 13 y un frontend React 19/Vite 8 independientes. Es un monolito modular con módulos de identidad/empresas, sucursales, salas y tarifas; no hay microservicios ni integración con hardware.

## Separación de responsabilidades

- `backend/app/Models`: entidades, relaciones y casts. `Concerns/BelongsToTenant` aplica un scope global a Branch, Room y RoomRate, y asigna la empresa al crear registros desde un contexto autorizado.
- `backend/app/Http/Middleware`: comprueba el usuario activo y resuelve empresa/pertenencia en cada petición. El contexto se limpia al terminar y está registrado como scoped para evitar fugas en workers persistentes.
- `backend/app/Http/Requests`: validación, campos prohibidos y autorización de escritura.
- `backend/app/Policies`: permisos de lectura y escritura según empresa y rol.
- `backend/app/Http/Controllers/Api/V1`: transporte HTTP, consultas acotadas y recursos JSON.
- `backend/app/Services`: transacciones de pertenencias y cambios de tarifa.
- `frontend/src/api`: cliente HTTP centralizado con cookies, XSRF, errores, cancelación y timeout.
- `frontend/src/auth`: identidad y empresas autorizadas, mantenidas en memoria; no hay tokens en localStorage.
- `frontend/src/components`: layout, modal nativo accesible, formularios, avisos, estado y paginación.
- `frontend/src/pages`: login, dashboard, sucursales/salas, tarifas, administración y health.

## Aislamiento multi-tenant

Una sola base PostgreSQL compartida. La sesión almacena `active_tenant_id`, que únicamente puede establecerse tras comprobar la pertenencia activa a una empresa activa. Cada petición operativa vuelve a comprobar ambos estados. Los identificadores enviados para selección son candidatos, nunca autoridad.

ResolveTenant se ejecuta después de autenticación y antes del binding de modelos. Los scopes fallan con 403 cuando no existe contexto. Los registros ajenos quedan fuera del binding y devuelven 404; las escrituras prohíben `tenant_id`. Las referencias de sucursal se validan dentro de la empresa, y claves compuestas ofrecen una segunda barrera a nivel SQL.

Las consultas a User/Tenant no llevan scope global porque representan identidades y pertenencias compartidas. Se acceden desde la identidad autenticada, la empresa resuelta o comandos administrativos privados. `withoutGlobalScopes` y consultas SQL operativas requieren revisión explícita.

RLS no está implementado. Los `tenant_id` explícitos, índices y contexto por petición preparan una futura política PostgreSQL; cualquier variable de sesión SQL deberá establecerse dentro de transacciones para evitar fugas con pooling.

## Autenticación y permisos

Sanctum usa el guard web, sesión del servidor y cookies HttpOnly/SameSite=Lax. `statefulApi()` habilita la sesión y protección contra falsificación en los orígenes autorizados. El login tiene middleware web explícito para conservar protección también cuando no hay origen SPA. No se emiten tokens personales.

El cliente obtiene `/sanctum/csrf-cookie` y envía `X-XSRF-TOKEN` al mutar. Laravel 13 permite solicitudes de origen verificado por `Sec-Fetch-Site: same-origin`; en caso contrario verifica el token. No se han excluido rutas de negocio de CSRF. Referencia: https://laravel.com/docs/13.x/csrf.

El login regenera la sesión. Logout la invalida y regenera el token. Login limita intentos por combinación correo/IP, además de un límite por IP. Un 401 o 419 lleva al frontend al login. El backend verifica cuentas, empresas y pertenencias activas en cada operación.

| Acción | Owner | Admin | Employee |
|---|---|---|---|
| Consultar empresa, dashboard, sucursales, salas y tarifas | Sí | Sí | Sí |
| Crear/editar/activar/desactivar/eliminar/restaurar sucursales y salas | Sí | Sí | No |
| Crear/reemplazar/eliminar/restaurar tarifas | Sí | Sí | No |
| Editar nombre/zona horaria de empresa | Sí | No | No |
| Consultar y gestionar miembros/roles | Sí | No | No |

No se puede degradar, desactivar ni eliminar al último propietario activo. El bloqueo de la fila de empresa serializa cambios de pertenencia. Las cuentas existentes conservan contraseña y nombre global al agregarse a otra empresa. Las actualizaciones de pertenencia solo aceptan rol y actividad; no alteran cuentas globales.

## Tarifas y disponibilidad

Solo `available`, `cleaning` y `maintenance` son estados editables. No existe ocupación persistida. El dashboard cuenta las salas activas disponibles cuya sucursal esté activa, y presenta totales reales de sucursales y salas (incluyen registros desactivados).

Dinero: NUMERIC(12,2), casts decimales y cadenas en API/React. Se acepta un máximo de 10 enteros y 2 decimales, sin negativos, notación científica ni float JSON. Solo USD en este MVP.

Cambiar tarifa bloquea la sala con `FOR UPDATE`, desactiva la tarifa anterior e inserta la nueva dentro de una transacción. Un índice único parcial impide dos activas incluso fuera del servicio. Reemplazar explícitamente una tarifa ya sustituida devuelve 409. No se modifica el precio de un registro histórico. Futuras sesiones deberán guardar una instantánea del precio contratado; todavía no existen.

## Alcance y operación

No hay registro público, recuperación externa de contraseñas, reservas, sesiones de karaoke, cobros, promociones ni ingresos simulados. Aprovisionamiento inicial mediante comando privado interactivo. Las bajas son lógicas.

Producción requiere HTTPS, APP_DEBUG=false, cookies Secure, usuario PostgreSQL con permisos mínimos, copias de seguridad y servidor web con raíz `backend/public`. La configuración Compose es de desarrollo. No usar Vite ni `artisan serve` como servidor de producción.

## Eliminaciones y coherencia operativa

BranchService protege las dependencias de sucursales; RoomService centraliza creación, movimiento, actividad, eliminación y restauración de salas. RoomRateService comparte su bloqueo de sucursal/sala. Todas las operaciones sensibles se ejecutan en transacciones y verifican de nuevo el estado tras obtener los bloqueos. Los movimientos de sala bloquean ambas sucursales en orden estable para evitar interbloqueos y conservan los precios existentes.

Una sucursal con salas no eliminadas no puede eliminarse, incluso si están inactivas. Para desactivarla primero deben desactivarse o moverse sus salas activas. No hay cascadas de eliminación: cada decisión es explícita. Al eliminar una sala, el precio vigente pasa al historial. Las relaciones de lectura conservan acceso a padres con SoftDeletes para poder mostrar el historial.

Las restauraciones de sucursales y salas las mantienen inactivas. Una sala requiere que su sucursal esté restaurada y activa. Los precios se restauran como históricos, sin desplazar el vigente; reutilizar un precio crea una nueva versión. Las eliminaciones y restauraciones se autorizan con Policies específicas y los listados de papelera mantienen el scope de tenant.

MembershipService serializa cambios con bloqueo de empresa. Eliminar una pertenencia marca removed_at, revoca su acceso y conserva el usuario global y otros negocios. Restaurar mantiene el acceso deshabilitado hasta una decisión explícita del propietario. No se pierde la protección del último owner.

Frontend reutiliza RecordActions para confirmaciones con descripción accesible, foco inicial en Cancelar, Escape, bloqueo durante la petición y retorno de foco al cerrar. Listado/Papelera utiliza botones con estado aria-pressed. Los errores de conflictos se muestran dentro del diálogo y mantienen la información visible.

La API fuerza respuestas JSON antes de autenticar, de modo que las peticiones privadas sin cabecera Accept reciben 401 en lugar de intentar una redirección a una ruta web inexistente. Sanctum ignora tokens Bearer en esta aplicación de primera parte y no consulta un almacén de tokens. La consulta de identidad en login compara correos sin distinguir mayúsculas y minúsculas, conservando el valor almacenado.
