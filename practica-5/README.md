# Práctica 5: Clínica de código completa

**Proyecto:** ISPAdmin, sistema de administración para un proveedor de internet
**Autor:** jpinedacastell
**Fecha:** 17 de noviembre de 2026

---

## Contenido de la carpeta

| Archivo | Qué es |
|---|---|
| [enfermo.js](enfermo.js) | La lógica de clientes como estaba antes: `if` anidados, `switch`, números mágicos y nombres sin significado. |
| [sano.js](sano.js) | El mismo comportamiento con Clean Code y SOLID aplicados. |
| [tests/clinica.test.js](tests/clinica.test.js) | Pruebas que corren los mismos casos contra los dos archivos. |
| [diagnostico.md](diagnostico.md) | Cada síntoma encontrado, su tratamiento y las líneas exactas en los dos archivos. |

Para correr las pruebas, desde la raíz del repo:

```bash
npm run test:practica5
```

Resultado: 53 pruebas, 0 fallos.

Temas cubiertos: elegancia del operador ternario, tipado fuerte, números
mágicos, complejidad condicional, polimorfismo vs enum, ser declarativo,
método de tabla y los cinco principios SOLID. El detalle está en
[diagnostico.md](diagnostico.md).

---

# Aplicación en el proyecto: configuración del sistema

**Versión:** `v1.3.0` (más `v1.4.0` con el ajuste del logo)

Las mismas técnicas se usaron en una funcionalidad real de ISPAdmin.

## Objetivo

Permitir que el administrador configure el sistema desde la aplicación, sin
editar código: el nombre, el logo, los datos de la empresa y los parámetros de
facturación. Antes, "ISP Admin", el logo y los datos de CONETXA estaban
escritos directamente en las vistas.

## Qué se hizo

La página **`/configuracion`** quedó organizada en pestañas:

| Pestaña | Qué se configura | Dónde se usa |
|---|---|---|
| **General** | Nombre del sistema y logo (PNG, JPG o WEBP, máximo 2 MB, con vista previa) | Menú lateral, barra superior, título de las pestañas, login y facturas |
| **Empresa** | Nombre, RTN, teléfono, dirección y email | Encabezado y marca de agua de las facturas, texto para compartir el recibo |
| **Facturación** | Día de generación (1–28), días de vencimiento (1–90) y prefijo del recibo (máx. 10) | Generación mensual de facturas |
| **Seguridad** | Cambio de contraseña (ya existía) | — |

Otros detalles:
- Al subir un logo nuevo se borra el anterior.
- Si hay logo, el menú lateral muestra solo la imagen. Sin logo, muestra el nombre.
- La página muestra mensajes de éxito o error al guardar.
- La configuración se guarda en memoria y se recarga solo cuando se cambia algo.

## Diseño

Cada capa hace una sola cosa:

```
Vista (configuracion.ejs)
   │  formulario POST
   ▼
Ruta (userRoutes.js) ── normaliza y valida ──► configuracionSistema.js (reglas)
   │
   ▼
ConfiguracionService ── caché en memoria
   │
   ▼
ConfiguracionRepository ── SQL ──► tablas config_sistema / config_facturacion

Middleware configuracionSistema.js ──► res.locals.sistema (disponible en todas las vistas)
```

- **Validaciones en tabla:** cada sección tiene su lista de reglas (`REGLAS_GENERAL`, `REGLAS_EMPRESA`, `REGLAS_FACTURACION`) en lugar de una cadena de `if`.
- **Sin números mágicos:** los límites están en `LIMITES`, y los formatos del logo en `FORMATOS_LOGO`.
- **Una sola ruta para tres secciones:** `SECCIONES_CONFIGURACION` define cómo normalizar, validar y guardar cada sección; la ruta es la misma para todas.
- **Respaldo:** si la tabla no existe o falla la BD, el sistema usa los valores de siempre (`CONFIG_POR_DEFECTO`).

## Archivos

**Nuevos**
- [src/domain/configuracion/configuracionSistema.js](../src/domain/configuracion/configuracionSistema.js): valores por defecto, límites y validaciones.
- [src/repositories/ConfiguracionRepository.js](../src/repositories/ConfiguracionRepository.js): acceso a la BD.
- [src/services/configuracion/ConfiguracionService.js](../src/services/configuracion/ConfiguracionService.js): caché y operaciones.
- [src/services/configuracion/index.js](../src/services/configuracion/index.js): instancia compartida.
- [src/middleware/configuracionSistema.js](../src/middleware/configuracionSistema.js): carga la configuración para las vistas.
- [src/migrations/007_config_sistema.js](../src/migrations/007_config_sistema.js): crea la tabla `config_sistema`.

**Modificados**
- [src/routes/userRoutes.js](../src/routes/userRoutes.js): rutas de configuración y subida del logo.
- [src/views/user/configuracion.ejs](../src/views/user/configuracion.ejs): pantalla con pestañas.
- [src/views/partials/header.ejs](../src/views/partials/header.ejs): logo y nombre en el menú.
- [src/views/auth/login.ejs](../src/views/auth/login.ejs): logo en el login.
- [src/views/facturas/ver.ejs](../src/views/facturas/ver.ejs): logo y datos de la empresa en la factura.
- [src/app.js](../src/app.js): registro del middleware y valores por defecto.
- [.gitignore](../.gitignore): ignora `public/img/uploads/`.

## Base de datos

Migración `007_config_sistema`:

```sql
CREATE TABLE config_sistema (
    id INT PRIMARY KEY,
    nombre_sistema VARCHAR(60) NOT NULL DEFAULT 'ISP Admin',
    logo_url VARCHAR(255) NOT NULL DEFAULT '/img/Logo.png',
    empresa_nombre VARCHAR(100),
    empresa_rtn VARCHAR(20),
    empresa_telefono VARCHAR(30),
    empresa_direccion VARCHAR(200),
    empresa_email VARCHAR(100),
    updated_at TIMESTAMP
);
```

Se crea con una sola fila que trae los valores que antes estaban fijos. Los
parámetros de facturación se guardan en la tabla `config_facturacion`, que ya
existía.

## Commits y Pull Requests

| Commit | Descripción | PR |
|---|---|---|
| `85df3ca` | `feat(configuracion): agregar configuración del sistema` | [#4](https://github.com/jpinedacastell/ISPAdmin/pull/4) |
| `1993e75` | `fix(configuracion): valores por defecto del sistema para todas las vistas` | [#4](https://github.com/jpinedacastell/ISPAdmin/pull/4) |
| — | `feat(configuracion): mostrar solo el logo en el menú lateral cuando existe` | [#5](https://github.com/jpinedacastell/ISPAdmin/pull/5) |

Versionado semántico: `feat` sube la versión minor (`v1.2.0` → `v1.3.0`).

## Cómo probarlo

1. Correr la migración: `node -e "require('./src/migrations/007_config_sistema').up()"`.
2. Iniciar sesión y abrir **Configuración** en el menú del usuario.
3. **General:** cambiar el nombre y subir un logo. Se ven en el menú y en el login.
4. **Empresa:** cambiar los datos y abrir cualquier factura para ver el encabezado.
5. **Facturación:** probar un día fuera de rango (por ejemplo 31) y ver el mensaje de error.
6. Subir un archivo SVG o de más de 2 MB: el sistema lo rechaza con un mensaje.
