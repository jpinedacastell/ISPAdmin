# ISPAdmin

Sistema web de administración para un proveedor de servicios de internet (ISP): clientes, planes, facturación mensual, pagos con abonos a favor, tickets de soporte y contabilidad.

> **Código de verificación:** `LEARN-CAP-7AA6B634`
>
> También está publicado en el sitio, en [`/verificacion.txt`](https://ispadmin.conetxahn.com/verificacion.txt) y en la etiqueta `<meta name="verificacion">` de la página de inicio de sesión.

**Sitio:** https://ispadmin.conetxahn.com
**Autor:** [jpinedacastell](https://github.com/jpinedacastell)

---

## Funcionalidades

| Módulo | Qué permite |
|---|---|
| **Clientes** | Crear clientes desde un modal (DNI y email opcionales), editarlos, cambiarles el plan, activarlos o desactivarlos, y eliminarlos. Un cliente con historial contable no se puede eliminar. |
| **Planes** | Ver, editar y activar o desactivar los planes de internet. |
| **Facturación** | Generar las facturas del mes, aplicar descuentos, registrar pagos parciales o completos, generar saldo a favor y aplicarlo a facturas pendientes. Incluye un resumen anual por cliente. |
| **Recibos** | Vista de la factura, descarga en PDF y envío por WhatsApp. |
| **Pagos y contabilidad** | Registrar gastos, y ver los ingresos y egresos del mes, incluidos los costos de los tickets. |
| **Tickets** | Abrir tickets de soporte con comentarios, fotos, servicios del catálogo y costos adicionales. |
| **Dashboard** | Clientes activos, ingresos del mes, ingresos por mes, distribución por plan y últimas instalaciones. |
| **Configuración** | Nombre del sistema, logo, datos de la empresa para las facturas, parámetros de facturación y cambio de contraseña. |

## Tecnologías

- **Backend:** Node.js 20, Express 4 y EJS.
- **Base de datos:** MariaDB / MySQL (`mysql2`).
- **Seguridad:** sesiones guardadas en la base de datos (`express-session`), protección CSRF (`csurf`) y contraseñas con `bcrypt`.
- **Interfaz:** Bootstrap 5, DataTables, SweetAlert2 y Chart.js. El PDF se genera en el navegador con jsPDF y html2canvas.
- **Producción:** PM2.

## Arquitectura

El código está organizado en capas. La lógica del negocio no conoce la base de datos: solo los repositorios escriben SQL (la **D de SOLID**, inversión de dependencias).

```
Rutas (HTTP)  →  Servicios (negocio)  →  Repositorios (SQL)  →  MariaDB
src/routes/      src/services/            src/repositories/
                 src/domain/ (reglas y validaciones)
```

- Las **rutas** leen la petición, llaman a un servicio y arman la respuesta.
- Los **servicios** contienen la lógica: cálculos, transacciones y qué se puede hacer. Reciben sus repositorios por el constructor, así que se pueden probar sin base de datos.
- Los **repositorios** son el único lugar con consultas SQL.

## Estructura

```
├── src/
│   ├── app.js            Punto de entrada
│   ├── routes/           Rutas por módulo
│   ├── services/         Lógica del negocio
│   ├── repositories/     Acceso a la base de datos
│   ├── domain/           Reglas, validaciones y value objects
│   ├── middleware/       Autenticación y configuración del sistema
│   ├── views/            Vistas EJS
│   ├── migrations/       Cambios de la base de datos, numerados
│   ├── database/         Esquema SQL y scripts de instalación
│   └── config/           Conexión a la base de datos
├── public/               Archivos públicos (imágenes, verificacion.txt)
├── practica-5/           Clínica de código: enfermo.js, sano.js, pruebas y diagnóstico
└── docs/                 Guion de la presentación y documentación
```

## Instalación

**Requisitos:** Node.js 20 o superior, y MariaDB 10.6+ o MySQL 8.

```bash
git clone https://github.com/jpinedacastell/ISPAdmin.git
cd ISPAdmin
npm install
```

Cree el archivo `.env` en la raíz con estas variables:

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto del servidor (por ejemplo `4003`) |
| `NODE_ENV` | `development` o `production` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a la base de datos |
| `SESSION_SECRET` | Clave para firmar las sesiones |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Clave y duración de los tokens |
| `CORS_ORIGIN` | Origen permitido para CORS |

> El archivo `.env` no se sube al repositorio.

**Base de datos:**
1. Cree las tablas con los scripts de `src/database/`: `schema.sql`, `planes_table.sql` y `facturas_tables.sql`.
2. Aplique las migraciones de `src/migrations/` en orden. Cada una tiene `up()` y `down()`.
3. Cree el primer administrador con `src/database/createAdmin.js` y **cambie la contraseña** desde **Configuración → Seguridad** al entrar.

## Uso

```bash
npm run dev     # desarrollo, con recarga automática (nodemon)
npm start       # producción
```

En producción el sistema corre con PM2:

```bash
pm2 start src/app.js --name ISP-Admin
pm2 restart ISP-Admin   # después de actualizar el código
```

## Pruebas

```bash
npm run test:practica5   # clínica de código: mismas pruebas para enfermo.js y sano.js
npm run check:db         # revisa que solo los repositorios usen la base de datos
npm test                 # ambas
```

## Flujo de trabajo

- Cada cambio se hace en una rama (`feat/…`, `fix/…`, `refactor/…`, `docs/…`) y entra a `main` por Pull Request.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/).
- Las versiones siguen [versionado semántico](https://semver.org/lang/es/) con tags `vX.Y.Z`:
  - `feat` sube la versión menor (`v1.3.0` → `v1.4.0`);
  - `fix` y `refactor` suben el parche (`v1.4.0` → `v1.4.1`).

## Documentación

- [`practica-5/`](practica-5/): clínica de código (enfermo, sano, pruebas y diagnóstico).
- [`docs/GUION_CLEAN_CODE.md`](docs/GUION_CLEAN_CODE.md): guion de la presentación de Clean Code y SOLID.
