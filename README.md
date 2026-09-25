# NIGHTLY

Plataforma social para descubrir qué pasa cada noche: fiestas, FM (fiestas mayores), discotecas, sesiones de DJ y planes, con un feed vertical de fotos y vídeos de la comunidad.

> **NIGHTLY** es un nombre provisional. Todo el branding sale de [`src/config/site.ts`](src/config/site.ts).

Ciclo principal: **descubrir → ir → publicar → interactuar → seguir → descubrir**.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 16 (App Router, React 19, Server Components), TypeScript, Tailwind CSS 4 |
| Backend | Route Handlers de Next.js (API REST bajo `/api`), capa de servicios en `src/server/services` |
| Base de datos | PostgreSQL + Prisma 6 |
| Auth | Sesiones propias en BD (cookie httpOnly, token con hash SHA-256) · email + contraseña (bcrypt) · Google OAuth (PKCE, `arctic`) |
| Media | `sharp` (imágenes → WebP en 2 tamaños, sin EXIF/GPS, placeholder blur) · `ffmpeg` (vídeo → H.264 720p, `faststart`, póster) |
| Mapas | Leaflet con proveedor intercambiable (CARTO sin clave; Mapbox/MapTiler vía proxy de teselas en servidor) |
| Tests | Vitest (unit) · Playwright (e2e) |

## Puesta en marcha

Requisitos: Node ≥ 20.9 y PostgreSQL ≥ 14.

```bash
cp .env.example .env          # ajusta DATABASE_URL
npm install                   # instala deps + prisma generate (+ ffmpeg estático opcional)
npm run db:migrate            # crea el esquema
npm run db:seed               # datos DEMO de Barcelona (tarda ~2-5 min: genera imágenes y vídeos)
npm run dev                   # http://localhost:3000
```

Cuentas demo (contraseña `nightly123`, configurable con `SEED_PASSWORD`):

| Email | Rol |
| --- | --- |
| `eric@nightly.demo` | usuario con posts, seguidores y notificaciones |
| `admin@nightly.demo` | administrador (panel en `/admin`) |

### Datos demo

`npm run db:seed` **borra la base de datos y el almacenamiento local** y crea una escena nocturna **ficticia**: 17 locales en Barcelona (y alguno en Madrid/Valencia), ~120 eventos con fechas relativas a *hoy*, 24 usuarios, publicaciones (fotos y vídeos), valoraciones, fotos de la comunidad, likes, comentarios y seguidores.

- Ningún local, persona o evento es real. Todo está marcado con `isDemo` y la interfaz lo muestra con la etiqueta **DEMO**.
- Las imágenes y vídeos se generan proceduralmente (sin fotos de lugares reales) y funcionan sin conexión.
- Como las fechas son relativas, vuelve a ejecutar el seed si pasan varios días.

Para datos reales, `Event.source = IMPORT` + `externalId` (único por fuente) están preparados para un importador.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo / build de producción / servidor |
| `npm run typecheck` · `npm run lint` | TypeScript · ESLint |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests end-to-end (Playwright, requiere BD con seed) |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:reset` | Prisma |

## Arquitectura

```
prisma/
  schema.prisma           Modelo de datos normalizado
  seed/                   Datos demo + generador de arte procedural
src/
  config/                 Marca, ciudades, categorías y géneros
  lib/                    Código compartido cliente/servidor (validadores zod, fechas, dinero, geo, tipos DTO)
  server/
    auth/                 Sesiones, contraseñas, proveedores OAuth
    services/             Lógica de negocio (eventos, locales, posts, usuarios, notificaciones, reportes, admin…)
    media/                Pipeline de imágenes y vídeo
    storage/              Abstracción de almacenamiento (local; lista para S3/R2)
    security/             Rate limiting
    jobs/                 Tareas periódicas (recordatorios, limpieza de subidas)
    http.ts               Wrapper de rutas API: auth, roles, CSRF, rate limit, errores
  app/
    (app)/                Páginas con la navegación principal
    (auth)/               Login y registro
    admin/                Panel de administración
    api/                  API REST
    media/[...key]        Servidor de ficheros (con HTTP Range para vídeo)
  components/             UI por dominio (events, venues, feed, map, social, forms, admin, ui)
tests/                    unit/ y e2e/
```

Las páginas son Server Components que llaman directamente a la capa de servicios; las interacciones (likes, voy, seguir, comentar…) usan la API REST con actualizaciones optimistas. La misma API sirve para una futura app móvil.

### Modelo de datos

`Country → City → Venue/Event/Post/Profile`, `User ↔ Profile`, `Account` (OAuth), `Session`, `Event` (con `Category`, `EventGenre`, `EventAttendance` INTERESTED/GOING, `SavedEvent`), `Venue` (`VenueGenre`, `VenueFollow`, managers), `Review` (única por usuario y local, con subpuntuaciones), `Photo` / `Video`, `Post` (`PostTag`, `Comment`, `Like`, `SavedPost`), `Follow`, `Notification` (con `dedupeKey` para idempotencia), `Report` (FK a cada tipo de contenido).

Los contadores (likes, asistentes, media de valoración, seguidores…) están desnormalizados y se actualizan en transacciones.

### Multi-ciudad

Todo se filtra por `cityId`. Para añadir una ciudad basta con incluirla en `src/config/cities.ts` (o insertar una fila en `City`). La ciudad activa se guarda en una cookie elegida por el usuario; **nunca se infiere la ubicación sin permiso**. La geolocalización es opcional y solo se usa en el dispositivo para distancias y "Cerca de mí".

### "Hoy" en la noche

Una noche va de 06:00 a 06:00 hora local de la ciudad: una fiesta a la 01:00 del sábado aparece en "Hoy" el viernes (`src/lib/time.ts`).

### Feed vertical

- Scroll-snap vertical + `IntersectionObserver` para decidir el elemento activo.
- Solo el elemento activo reproduce; solo ±2 elementos montan `<video>` (memoria y datos).
- Vídeos transcodificados a H.264/AAC 720p con `faststart`, pósters WebP y soporte de HTTP Range.
- "Para ti": puntuación por interacción con decaimiento temporal, ponderada por ciudad y por gente que sigues. "Siguiendo": cronológico de usuarios y locales seguidos.
- Doble toque = like, teclas ↑/↓ y `m` (silencio) en escritorio.

### Mapas

`MapCanvas` define la interfaz del mapa; la implementación actual usa Leaflet. `MAP_PROVIDER` elige proveedor:

- `carto` (por defecto): teselas oscuras sin clave.
- `mapbox` / `maptiler`: las teselas pasan por `/api/map/tiles/{z}/{x}/{y}` para que la clave **nunca llegue al navegador**.

Para Google Maps o Mapbox GL basta con otra implementación de `MapCanvasProps`.

### Moderación

- Reportes de usuario, evento, local, publicación, foto, vídeo y comentario (motivos: spam, inapropiado, acoso, evento falso, información incorrecta, otro). Uno por usuario y contenido.
- Con `AUTO_HIDE_REPORT_THRESHOLD` reportes distintos el contenido se oculta hasta revisión.
- `EVENT_MODERATION`: `off` · `new_users` (cuentas de menos de 7 días pasan revisión) · `all`.
- Panel `/admin` (roles MODERATOR/ADMIN): resumen, reportes (descartar, retirar, restaurar, suspender autor), eventos (aprobar, rechazar, destacar, editar, eliminar), usuarios (suspender, roles), locales (editar ficha, destacar, desactivar), publicaciones.

### Notificaciones

In-app (tabla `Notification`) para: nuevos seguidores, likes, comentarios, etiquetas, recordatorio "tu evento empieza en 2 horas", nuevo evento en un local que sigues y moderación. `registerNotificationChannel()` permite añadir push/email sin tocar el resto del código.

Tareas periódicas (`src/server/jobs`): se ejecutan dentro del proceso si `ENABLE_INPROCESS_JOBS=true`, o desde un cron externo:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/event-reminders
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/cleanup-uploads
```

## Seguridad

- Validación de toda entrada con zod (`src/lib/validators.ts`); textos normalizados.
- React escapa todo el contenido; no hay `dangerouslySetInnerHTML`. CSP estricta, `X-Frame-Options`, `nosniff`, HSTS en producción.
- Prisma parametriza todas las consultas (la única SQL manual usa `Prisma.sql`).
- Contraseñas con bcrypt (coste 12) y comparación de tiempo constante para emails inexistentes.
- Sesiones opacas en BD (solo se guarda el hash), cookie `httpOnly` + `SameSite=Lax` + `Secure` en producción; se invalidan al suspender una cuenta.
- CSRF: comprobación de `Origin` en todas las mutaciones.
- OAuth con `state` + PKCE; enlace de cuentas solo con email verificado.
- Autorización por recurso (solo el autor/organizador o moderadores editan/borran; las subidas solo las puede adjuntar su propietario).
- Rate limiting por IP/usuario (login, registro, subidas, comentarios, reportes…), interfaz lista para Redis.
- Subidas validadas por contenido real (se decodifica la imagen / se analiza el vídeo con ffprobe), límites de tamaño y duración, metadatos eliminados.
- Antispam: honeypot en registro, límite de enlaces y duplicados en comentarios.
- Redirecciones solo relativas (sin open redirect). Secretos solo en variables de entorno del servidor.

## Rendimiento

- Server Components + consultas en paralelo y `select` mínimos; índices en las columnas de filtrado/orden.
- Imágenes pre-optimizadas (WebP 480/1280 px) servidas con caché inmutable y `next/image` con loader propio y placeholder blur.
- Compresión de fotos en el navegador antes de subir.
- Paginación por cursor + scroll infinito; skeletons y `loading.tsx`.
- Mapa cargado de forma diferida (solo cliente).

## Autenticación con Google

1. Crea un OAuth Client (Web) en Google Cloud.
2. URI de redirección: `{APP_URL}/api/auth/oauth/google/callback`.
3. Rellena `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. El botón aparece automáticamente.

Apple/TikTok: implementa `OAuthProvider` en `src/server/auth/oauth/providers.ts`.

## Almacenamiento

`STORAGE_DRIVER=local` guarda en `STORAGE_LOCAL_DIR`. Para S3/R2 implementa `StorageDriver` (`src/server/storage/index.ts`). Si no hay ffmpeg disponible, los vídeos MP4/WebM se aceptan sin transcodificar.

## Próximos pasos sugeridos

- Cola de trabajos (BullMQ) para transcodificar vídeo y enviar notificaciones push.
- Rate limiting y caché en Redis al escalar horizontalmente.
- Búsqueda con `pg_trgm` / full-text sobre `searchText`.
- Importadores de eventos reales (`EventSource.IMPORT`).
