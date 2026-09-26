# App de escritorio (Windows) y móvil

## Windows — `NIVEX-Setup-x.y.z.exe`

Instalador NSIS autocontenido (Electron + PostgreSQL embebido + servidor Next.js + datos DEMO). Funciona sin conexión y sin instalar nada más.

- Primera ejecución: crea la base de datos en `%APPDATA%\NIVEX\data` y carga los datos DEMO (~30 s).
- Las fechas DEMO se desplazan por semanas completas en cada arranque para que siempre haya planes "hoy".
- Menú **NIVEX → Reiniciar datos de demostración** borra y recrea los datos.
- Cuentas demo: `eric@nightly.demo` / `admin@nightly.demo`, contraseña `nightly123`.
- El `.exe` no está firmado: SmartScreen muestra "Windows protegió su PC" → *Más información* → *Ejecutar de todas formas*.
- Log: `%APPDATA%\NIVEX\data\nivex.log`.

## Móvil (Android / iPhone)

El servidor del PC escucha en la red local (`0.0.0.0`). Con el PC y el móvil en la misma Wi‑Fi:

1. En la app de Windows: **NIVEX → Abrir en el móvil…** (Ctrl+M) muestra un QR.
2. Escanéalo con el móvil.
3. Instálala como app (PWA): Android/Chrome → *Añadir a pantalla de inicio*; iPhone/Safari → *Compartir → Añadir a inicio*.

Notas: la primera vez Windows pide permiso en el Firewall (acepta "Redes privadas"). Por HTTP en red local los navegadores móviles no permiten geolocalización; el resto funciona.

Un APK/IPA nativo requiere el SDK de Android o un Mac con cuenta de Apple; la API REST ya está preparada para una app nativa futura.

## Generar el instalador

Requisitos (Linux): Node 22, PostgreSQL local para generar los datos demo, `wine64` + `wine32` (NSIS).

```bash
bash scripts/build-desktop.sh                 # completo → dist-desktop/NIVEX-Setup-*.exe
REUSE_DEMO=1 bash scripts/build-desktop.sh    # reutiliza el volcado demo anterior
bash scripts/build-desktop.sh --resources-only --keep-host-natives   # solo recursos (pruebas en Linux)
```

Estructura: `desktop/main.mjs` (Electron), `desktop/backend.mjs` (arranca PostgreSQL y `server.js`, ejecutable en Node puro: `node desktop/backend.mjs <resources> <data>`), `desktop/resources/server` (build *standalone* de Next).
