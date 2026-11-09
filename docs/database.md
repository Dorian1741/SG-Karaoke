# Base de datos

PostgreSQL es el único motor. Compose usa `postgres:18-alpine`, volumen persistente en `/var/lib/postgresql` y puerto de host ligado a 127.0.0.1. El usuario inicial de la imagen es administrador; para producción hay que separar el rol migrador del usuario de ejecución.

## Relaciones

- `users`: UUID, nombre, correo único, contraseña hash, is_active, timestamps y campos estándar de Laravel. Una identidad puede tener varias pertenencias.
- `tenants`: UUID, name, slug único, status (`active`/`inactive`), timezone, timestamps.
- `tenant_user`: clave primaria compuesta tenant_id/user_id, role (`owner`/`admin`/`employee`), is_active, removed_at nullable, timestamps. Ambas referencias con FK.
- `branches`: UUID, tenant_id, name, address nullable, is_active, deleted_at nullable, timestamps. Índices `(tenant_id,id)` único y `(tenant_id,is_active)`.
- `rooms`: UUID, tenant_id, branch_id, name, description nullable, capacity > 0, operational_status, is_active, deleted_at nullable, timestamps. FK `(tenant_id,branch_id)` a branches; índice único `(tenant_id,id)` e índices de búsqueda por empresa/sucursal/actividad/estado.
- `room_rates`: UUID, tenant_id, room_id, name, hourly_price NUMERIC(12,2) >= 0, currency USD, is_active, deleted_at nullable, timestamps. FK `(tenant_id,room_id)` a rooms. Índice de historial y único parcial `(tenant_id,room_id) WHERE is_active`.

Las referencias operativas usan RESTRICT al eliminar; las APIs no ofrecen borrado físico. La tabla de sesiones de Laravel usa referencia UUID nullable a User. Las tablas de cache/jobs del esqueleto permanecen, aunque se usa cache/sesiones en archivos y cola sync en desarrollo.

## Migraciones nuevas

1. `2026_11_09_195304_convert_users_to_uuid`: convierte IDs numéricos de usuarios y referencias de sesiones mediante un mapa temporal, conserva registros y añade is_active e índice único de correo sin distinción de mayúsculas. Se ejecuta en transacción PostgreSQL. El payload de sesiones antiguas puede contener IDs previos: los usuarios deberán iniciar sesión nuevamente. Si existen correos duplicados por mayúsculas, la migración falla y revierte para que un operador revise los datos.
2. `2026_11_09_195305_create_tenant_foundations`: crea empresas, pertenencias, sucursales, salas, tarifas, índices y restricciones CHECK/FK.

No se modificó la migración inicial ya existente. La conversión a UUID no tiene reversión automática; `down()` la rechaza para evitar una conversión destructiva. Antes de migrar una base con datos: respaldo, ensayo de actualización y ventana de mantenimiento. No usar `migrate:fresh` en bases de aplicación.

## Pruebas

`karaokeos_test` es una base separada. `phpunit.xml` fija ese nombre y DatabaseTestCase comprueba `current_database()` y el entorno antes de RefreshDatabase. La suite puede borrar y reconstruir exclusivamente esa base. No apuntar DB_URL a una base de producción. El seeder E2E comprueba las mismas condiciones y exige contraseña por variable de proceso.

Pruebas y procesos E2E no deben ejecutarse simultáneamente sobre la misma base: la suite PHPUnit reconstruye su esquema y revierte fixtures por prueba.

## Migración de papelera

`2026_11_09_214905_add_recoverable_deletion_to_operational_records` añade deleted_at a branches, rooms y room_rates y removed_at a tenant_user. Añade índices por tenant/fecha y restricciones CHECK para exigir que todo registro eliminado esté inactivo. Mantiene las FK compuestas, los importes y el índice que garantiza un único precio activo.

SoftDeletes conserva filas y referencias. Las pertenencias usan removed_at porque son pivots; no se elimina la identidad global. La migración es adicional y no modifica las migraciones anteriores. Se probó en karaokeos_test y se aplicó a karaokeos_demo después de guardar un respaldo fuera del repositorio; no se eliminaron datos de la demostración.
