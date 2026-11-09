# KaraokeOS — reglas de desarrollo

- Mantener dos aplicaciones independientes: `backend/` Laravel API REST y `frontend/` React + Vite. PostgreSQL es la única base de datos; no usar SQLite ni en pruebas.
- Arquitectura de monolito modular, sin microservicios. Respetar las convenciones oficiales y las instrucciones específicas de cada aplicación.
- API versionada bajo `/api/v1`, respuestas JSON y códigos HTTP apropiados. Mantener los controladores pequeños; incorporar módulos de dominio cuando exista funcionalidad real que los requiera.
- La plataforma deberá admitir empresas (tenants), sucursales y salas. Al introducir datos de negocio, exigir contexto de empresa, autorización y aislamiento en consultas, restricciones y pruebas. Nunca confiar en un tenant enviado por el cliente sin validarlo.
- No implementar reservas, sesiones de karaoke ni pagos hasta que se soliciten. El contexto futuro contempla horas completas, pago anticipado y extensiones a la misma tarifa horaria.
- Revisar archivos antes de modificarlos. No introducir secretos, archivos `.env`, dependencias instaladas ni artefactos de compilación en Git. Mantener `.env.example` actualizado y sin credenciales reales.
- Comprobar versiones y requisitos antes de instalar dependencias. Usar Composer y npm locales al proyecto; conservar los lockfiles. No instalar herramientas globales sin autorización.
- Evitar dependencias y abstracciones innecesarias. React consume la API; no añadir una segunda interfaz de producto dentro de Laravel.
- Ejecutar pruebas relevantes y comunicar resultados y bloqueos reales. Las pruebas de integración usan PostgreSQL; no simular una ejecución exitosa si no hay infraestructura.
- Antes de finalizar PHP, ejecutar Pint. Antes de finalizar frontend, ejecutar lint y build. Documentar comandos reproducibles y decisiones relevantes en README.md.

## Fundamentos SaaS implementados (Tarea 002)

- Sanctum SPA con sesiones/cookies; no introducir tokens en localStorage ni excluir rutas mutables de CSRF. Laravel 13 verifica origen y, como fallback, token XSRF.
- TenantContext es scoped; ResolveTenant valida usuario/pertenencia/empresa y se ejecuta antes de bindings. Branch, Room y RoomRate usan scope global que falla sin contexto. No quitar scopes en operaciones HTTP.
- Owner/admin administran sucursales, salas y tarifas; solo owner administra empresa y miembros. Proteger al último owner activo. Policies del backend son obligatorias.
- Preservar FK compuestas tenant/sucursal y tenant/sala; no aceptar tenant_id de formularios. No implementar RLS todavía.
- Dinero como cadenas decimales y NUMERIC(12,2), nunca float. Cambios de tarifa mediante RoomRateService, bloqueo de sala e índice parcial único; conservar historial.
- Identidades globales UUID con pertenencias múltiples. No modificar nombre/contraseña global al gestionar una pertenencia.
- Las pruebas destructivas solo pueden usar karaokeos_test tras verificar current_database(). No ejecutar PHPUnit simultáneamente con E2E. Nunca usar migrate:fresh sobre una base de aplicación.
- No cambiar migraciones ya ejecutadas. La migración adicional de UUID debe conservar usuarios y referencias; cualquier futura reversión requiere respaldo revisado.
- Frontend directamente en frontend/, cliente HTTP en src/api, React Router y Tailwind. Mantener etiquetas accesibles y cancelación de peticiones al cambiar de pantalla/empresa.
- Mantener docs/architecture.md, docs/database.md, docs/api.md y docs/development.md alineados con código y resultados reales.

## Ciclo de vida de registros

- Eliminar sucursales, salas y precios significa SoftDeletes con papelera/restauración. No ofrecer forceDelete ni cascadas físicas de datos de negocio.
- Una sucursal con salas no eliminadas no se puede eliminar. Desactivar una sucursal requiere desactivar o mover sus salas activas.
- RoomService y RoomRateService bloquean sucursal y sala dentro de transacciones. Crear/mover/activar salas y configurar precios requiere padres autorizados y activos. Mover una sala dentro del mismo tenant conserva sus precios.
- Eliminar una sala desactiva su precio vigente y conserva el historial. Restaurar sala/sucursal conserva el estado inactivo; el usuario decide cuándo activar.
- Restaurar un precio lo devuelve al historial sin activarlo ni alterar el vigente. Para reutilizar un importe se crea una nueva versión mediante el servicio de precios.
- Eliminar del equipo marca tenant_user.removed_at e is_active=false; conserva User y las pertenencias de otras empresas. Restaurar no habilita acceso. Mantener al último owner activo.
- Las consultas de papelera conservan el scope de tenant y requieren permisos de gestión. deleted_at/removed_at nunca se aceptan desde formularios.
- Las confirmaciones de eliminación deben explicar el efecto, iniciar con foco en Cancelar y permitir Escape cuando no hay una operación pendiente.

- Mantener EnsureApiJson antes de la autenticación de API. Sanctum usa solo sesiones y no consulta tokens personales. El login compara correos sin distinción de mayúsculas sin modificar registros históricos.
