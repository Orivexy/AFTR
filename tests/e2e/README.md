# Tests end-to-end

```bash
npm run build          # los tests usan el build de producción
npm run test:e2e       # arranca scripts/e2e-server.sh en :3100 y ejecuta Playwright
```

- `scripts/e2e-server.sh` **recrea** una base de datos aislada (`app_e2e` por
  defecto, `E2E_DATABASE_URL` para cambiarla; su nombre debe contener `e2e` o
  `test`), aplica las migraciones, ejecuta el seed base con un admin de prueba
  y carga `fixtures.mts` (un local y dos eventos). Nunca toca la base de datos
  de desarrollo ni la de producción.
- Todo lo demás (usuarios, fotos, publicaciones, comentarios, reportes,
  solicitudes de negocio…) lo crean los propios tests con la UI y la API reales.
- Sin SMTP, sin claves externas y sin jobs en segundo plano: se comprueba que
  la app lo explica en vez de simularlo.
- `E2E_BASE_URL=https://… npm run test:e2e` ejecuta los tests contra una
  instancia ya desplegada (sin recrear nada).

| Spec | Qué cubre |
| --- | --- |
| `guest` | Inicio, evento, local, filtros de Descubrir, mapa, búsqueda, rutas protegidas, recuperación sin SMTP |
| `user-flow` | Registro → logout/login → perfil → búsqueda → voy/guardar → seguir local → publicar foto → like/comentario → seguir → notificaciones → reportar → bloquear → crear evento → cambiar contraseña; borrar cuenta |
| `admin` | Permisos, aprobar evento, resolver reporte, suspender/reactivar, cerrar/abrir registro, crear local, páginas de datos |
| `business` | Solicitud de local → aprobación → gestionar ficha → evento oficial sin revisión |
| `api-security` | Sesión obligatoria, CSRF, subidas por contenido, IDOR, escalada de rol, cron, rutas de media, rate limit, cabeceras |
| `responsive` | 360/768/1440 px sin scroll horizontal ni errores de consola, páginas privadas y de admin, enlaces internos |
