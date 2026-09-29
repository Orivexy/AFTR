# App de escritorio (Windows) y móvil

## Windows — `ORIVEXY-NIGHTS-Setup-x.y.z.exe`

Instalador NSIS autocontenido (Electron + PostgreSQL embebido + runtime de Visual C++ + ffmpeg + servidor Next.js + esquema y datos base). No hace falta instalar nada más.

**Descarga:** pestaña *Releases* del repositorio. El workflow [`desktop.yml`](../.github/workflows/desktop.yml) genera y publica el `.exe` en cada push a `main` (prerelease) o al crear un tag `v*` (release).

- Se instala en `C:\Program Files\ORIVEXY NIGHTS` (pide permiso de administrador): PostgreSQL para Windows no admite rutas con acentos.
- Primera ejecución: crea la base de datos en `%APPDATA%\ORIVEXY NIGHTS\data` (o en `%ProgramData%\ORIVEXY-NIGHTS\…` si el nombre de usuario tiene acentos), aplica las migraciones y carga los datos base (ciudades, categorías, géneros, fuentes). En cada actualización aplica solo las migraciones nuevas, sin tocar tus datos.
- No incluye contenido inventado. **La primera cuenta que registres es la de administrador.**
- Con conexión a Internet, la sincronización descarga los locales reales de OpenStreetMap (Barcelona por defecto) en el primer minuto; los eventos llegan de las fuentes que configures en *Admin → Event Discovery* y de lo que publiquéis.
- Arranque rápido:
  - PostgreSQL y el servidor arrancan en paralelo.
  - `initdb --no-sync` y `synchronous_commit=off`.
  - Caché de compilación de Node (`NODE_COMPILE_CACHE`).
  - Precalentado de Inicio, Mapa y Descubrir.
  - Medido en Linux: primer arranque ~1,4 s, siguientes ~0,6 s hasta el servidor listo.
- Cerrar la ventana deja ORIVEXY NIGHTS en la **bandeja del sistema**: volver a abrirlo es instantáneo. Para cerrarlo del todo: clic derecho en el icono de la bandeja → **Salir**.
- Menú **ORIVEXY NIGHTS → Iniciar con Windows** arranca ORIVEXY NIGHTS oculto al encender el PC, para que esté listo al abrirlo.
- Menú **ORIVEXY NIGHTS → Borrar datos locales…** elimina la base de datos y los archivos de este ordenador y vuelve a empezar.
- Sin SMTP configurado, la recuperación de contraseña indica que no está disponible: cambia la contraseña desde *Ajustes* mientras tengas sesión.
- El `.exe` no está firmado: SmartScreen muestra "Windows protegió su PC" → *Más información* → *Ejecutar de todas formas*.
- Log: `orivexy-nights.log` en la carpeta de datos (menú **ORIVEXY NIGHTS → Ver carpeta de datos**).

## Móvil (Android / iPhone)

El servidor del PC escucha en la red local (`0.0.0.0`). Con el PC y el móvil en la misma Wi‑Fi:

1. En la app de Windows: **ORIVEXY NIGHTS → Abrir en el móvil…** (Ctrl+M) muestra un QR.
2. Escanéalo con el móvil.
3. Instálala como app (PWA): Android/Chrome → *Añadir a pantalla de inicio*; iPhone/Safari → *Compartir → Añadir a inicio*.

Notas: la primera vez Windows pide permiso en el Firewall (acepta "Redes privadas"). Por HTTP en red local los navegadores móviles no permiten geolocalización; el resto funciona.

Un APK/IPA nativo requiere el SDK de Android o un Mac con cuenta de Apple; la API REST ya está preparada para una app nativa futura.

## Generar el instalador

Requisitos (Linux): Node 22, PostgreSQL local para generar los datos base, `python3` + `pip` (runtime de Visual C++ desde PyPI) y `wine64` + `wine32` (NSIS). Con `NSIS_DOCKER=1` se usa la imagen `electronuserland/builder:wine` en lugar de wine local.

```bash
bash scripts/build-desktop.sh                 # completo → dist-desktop/ORIVEXY-NIGHTS-Setup-*.exe
bash scripts/build-desktop.sh --resources-only --keep-host-natives   # solo recursos (pruebas en Linux)
```

Logo e iconos: `node scripts/generate-icons.mjs` genera, desde `scripts/logo.mjs`, los iconos web/PWA, el `.ico` de Windows (incrustado en `ORIVEXY NIGHTS.exe`, accesos directos e instalador) y las imágenes del asistente de instalación.

Estructura: `desktop/main.mjs` (Electron), `desktop/backend.mjs` (arranca PostgreSQL y `server.js`, ejecutable en Node puro: `node desktop/backend.mjs <resources> <data>`), `desktop/resources/server` (build *standalone* de Next).

## Cambio de nombre (antes NIVEX)

El instalador de ORIVEXY NIGHTS actualiza encima de una instalación anterior de NIVEX (mismo identificador interno `app.nivex.desktop`) y sigue usando su carpeta de datos (`%APPDATA%\NIVEX\data`), así que no se pierden cuentas, fotos ni eventos. Las instalaciones nuevas guardan los datos en `%APPDATA%\ORIVEXY NIGHTS\data`.
