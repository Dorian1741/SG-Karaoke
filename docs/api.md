# API v1

Prefijo de negocio `/api/v1`. Autenticación de primera parte con cookies Sanctum. Todas las respuestas de datos de negocio usan `{ "data": ... }`; colecciones paginadas añaden `links` y `meta`. Errores usan `message` y, para validación, `errors`. El healthcheck conserva el contrato de Tarea 001 sin envoltura.

## Identidad y contexto

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/sanctum/csrf-cookie` | Inicializar CSRF (204), fuera de v1 por convención Sanctum |
| POST | `/api/v1/auth/login` | email/password, limita intentos; 200 |
| GET | `/api/v1/auth/me` | Usuario y active_tenant_id |
| POST | `/api/v1/auth/logout` | Invalidar sesión; 204 |
| GET | `/api/v1/tenants` | Empresas activas con pertenencia activa y rol |
| POST | `/api/v1/tenants/select` | tenant_id UUID; verificar pertenencia; 200/404 |
| GET | `/api/v1/health` | 200 conectado / 503 no disponible; límite 60/min |

Un usuario con una única empresa autorizada la recibe seleccionada al entrar. Con varias debe elegir. El resto de rutas exige empresa seleccionada, cuenta activa y pertenencia activa.

## Operación

| Métodos | Ruta | Datos y permisos |
|---|---|---|
| GET | `/dashboard` | Nombre, timezone, rol y conteos reales |
| GET, PATCH | `/tenant` | Consulta; owner puede editar name/timezone |
| GET, POST | `/branches` | Listar; owner/admin crean name/address |
| GET, PATCH | `/branches/{branch}` | Detalle; owner/admin editan name/address |
| POST | `/branches/{branch}/deactivate` | Baja lógica por owner/admin |
| GET, POST | `/rooms` | Listar; owner/admin crean branch_id/name/capacity y opcional description/operational_status |
| GET, PATCH | `/rooms/{room}` | Detalle; owner/admin editan campos operativos |
| POST | `/rooms/{room}/deactivate` | Baja lógica por owner/admin |
| GET | `/rates` | Historial de tarifas |
| POST | `/rooms/{room}/rates` | Crear tarifa vigente; reemplaza la anterior si existe |
| POST | `/rates/{rate}/replace` | Reemplazar tarifa activa; 409 si dejó de estar activa |
| GET, POST | `/members` | Solo owner: listar/agregar miembros |
| PATCH | `/members/{user_uuid}` | Solo owner: role/is_active, conserva último owner |

Las rutas de esta tabla se añaden a `/api/v1`. No hay registro público ni recuperación externa. Los endpoints DELETE envían registros a la papelera y no borran físicamente sus datos.

Crear sucursal/sala/tarifa/pertenencia responde 201. Consultar/actualizar/activar/desactivar/restaurar responde 200. Eliminar responde 204. No autenticado: 401; acción/contexto prohibido: 403; recurso inexistente/ajeno: 404; validación: 422; conflicto: 409; límite: 429 con Retry-After; CSRF inválido sin origen verificado: 419.

Crear o reemplazar tarifa requiere `{ "name": "Estándar", "hourly_price": "20.00", "currency": "USD" }`. Los importes son cadenas decimales y se devuelven con dos decimales. El histórico no se edita.

Agregar miembro requiere name/email/role. `password` es obligatorio para cuentas nuevas (12 caracteres, mayúsculas, minúsculas y números); si la identidad existe, se conserva su nombre y contraseña. Las pertenencias existentes devuelven 409; se modifican por PATCH. La actividad de pertenencia no altera la actividad global del usuario.

## Listados

Sucursales/salas/tarifas admiten `page`, `per_page` (1–100, predeterminado 20), `search` y `is_active=0|1`. Salas añade `branch_id` y `operational_status`; tarifas añade `room_id`. Miembros admite page/per_page. Orden estable por nombre/id o fecha/id para historial.

`tenant_id` e `id` están prohibidos en los formularios de escritura, salvo selección explícita de empresa, que valida pertenencia. La empresa se asigna desde sesión verificada. Referencias operativas de otra empresa nunca se aceptan.

## Cookies

Usar el mismo origen del frontend para `/api` y `/sanctum` (proxy en desarrollo). Enviar Accept application/json, credentials include y X-XSRF-TOKEN desde la cookie XSRF-TOKEN al mutar. El navegador debe enviar Origin o Referer de un origen configurado en SANCTUM_STATEFUL_DOMAINS para activar las sesiones en las rutas API.

## Papelera, activación y restauración

Todas las rutas siguientes usan el prefijo `/api/v1`:

| Método | Ruta | Regla |
|---|---|---|
| DELETE | `/branches/{branch}` | Owner/admin; sin salas no eliminadas; 409 si tiene salas |
| DELETE | `/rooms/{room}` | Owner/admin; desactiva el precio vigente y conserva historial |
| DELETE | `/rates/{rate}` | Owner/admin; conserva el importe y desactiva el precio |
| DELETE | `/members/{member}` | Solo owner; elimina la pertenencia, conserva User; protege último owner |
| POST | `/branches/{branch}/activate` | Owner/admin |
| POST | `/rooms/{room}/activate` | Owner/admin; sucursal activa |
| POST | `/branches/{branch}/restore` | Restaura como inactiva |
| POST | `/rooms/{room}/restore` | Requiere sucursal restaurada y activa; restaura como inactiva |
| POST | `/rates/{rate}/restore` | Requiere padres no eliminados; restaura como precio anterior |
| POST | `/members/{member}/restore` | Solo owner; restaura sin habilitar acceso |

Listados de branches/rooms/rates/members admiten `trashed=only` para consultar su papelera. Requieren permisos de gestión, mantienen paginación y aislamiento por tenant. Los listados normales excluyen eliminados. Las rutas normales devuelven 404 para registros eliminados; las de restore permiten bindings con SoftDeletes sin quitar el scope de empresa. Restaurar un registro ya restaurado devuelve 409.

Desactivar una sucursal con salas activas devuelve 409. Crear, mover o activar una sala requiere una sucursal activa y autorizada. Los cambios se vuelven a comprobar bajo bloqueo dentro de la transacción. deleted_at y removed_at están prohibidos en formularios de escritura.

La API devuelve JSON incluso si el cliente omite Accept. Una petición privada sin sesión autorizada devuelve 401; los tokens Bearer no se usan para iniciar sesión. Login acepta correos almacenados originalmente con mayúsculas sin modificar la identidad global.
