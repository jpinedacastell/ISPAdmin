# Diagrama de contexto: ISPAdmin

Quién usa el sistema, qué hace el sistema y con qué sistemas externos se comunica.

```mermaid
flowchart LR
    %% Actores
    admin["👤 <b>Administrador del ISP</b><br/>Gestiona clientes, planes,<br/>facturas, pagos y tickets"]
    cliente["👤 <b>Cliente del ISP</b><br/>Recibe su recibo<br/>(no entra al sistema)"]

    %% Sistema
    subgraph ispadmin["🖥️ ISPAdmin (Node.js · Express · EJS)"]
        direction TB
        web["<b>Interfaz web</b><br/>Vistas EJS + Bootstrap"]
        modulos["<b>Módulos</b><br/>Clientes · Planes · Facturación<br/>Pagos · Tickets · Reportes<br/>Contabilidad · Configuración"]
        seguridad["<b>Seguridad</b><br/>Sesión · CSRF · bcrypt"]
        archivos[("<b>Archivos subidos</b><br/>Logo · fotos de tickets")]
        web --> modulos
        modulos --> seguridad
        modulos --> archivos
    end

    %% Sistemas externos
    db[("🗄️ <b>MariaDB</b><br/>Clientes, planes, facturas,<br/>pagos, tickets, sesiones,<br/>configuración")]
    whatsapp["💬 <b>WhatsApp</b><br/>wa.me"]
    cdn["🌐 <b>CDNs</b><br/>jsDelivr · cdnjs · DataTables<br/>jQuery · Google Fonts · Unsplash"]
    pm2["⚙️ <b>Servidor + PM2</b><br/>Proceso ISP-Admin · puerto 4003"]
    github["📦 <b>GitHub</b><br/>Repositorio ISPAdmin"]

    %% Relaciones
    admin -->|"Usa desde el navegador"| web
    modulos -->|"Lee y guarda datos (mysql2)"| db
    seguridad -->|"Guarda sesiones"| db
    web -->|"Carga librerías JS/CSS<br/>y genera PDF (jsPDF)"| cdn
    admin -->|"Envía el recibo"| whatsapp
    whatsapp -->|"Mensaje con el recibo"| cliente
    pm2 -->|"Ejecuta"| ispadmin
    github -.->|"Código fuente (git pull)"| pm2

    %% Estilos
    classDef actor fill:#e8f1ff,stroke:#2f6fdb,color:#0b2a5b
    classDef externo fill:#f3f3f3,stroke:#888,color:#222,stroke-dasharray:4 3
    classDef interno fill:#eafaf0,stroke:#2e9e5b,color:#0d3b22
    class admin,cliente actor
    class db,whatsapp,cdn,pm2,github externo
    class web,modulos,seguridad,archivos interno
```

## Actores

| Actor | Qué hace |
|---|---|
| **Administrador del ISP** | Es el único rol con usuario (tabla `administradores`). Entra con usuario y contraseña, y gestiona clientes, planes, facturas, pagos, tickets, reportes, contabilidad y la configuración. |
| **Cliente del ISP** | No entra al sistema. Es la persona que recibe el servicio de internet; le llega su recibo por WhatsApp o en PDF. |

## Sistema: ISPAdmin

| Parte | Qué hace |
|---|---|
| **Interfaz web** | Páginas EJS con Bootstrap, DataTables y SweetAlert2. |
| **Módulos** | Clientes, Planes, Facturación, Pagos, Tickets, Reportes, Contabilidad y Configuración (una ruta de Express por módulo en `src/routes/`). |
| **Seguridad** | Sesión guardada en la BD (`express-session`), protección CSRF (`csurf`) y contraseñas con `bcrypt`. |
| **Archivos subidos** | El logo del sistema (`public/img/uploads/`) y las fotos de los tickets (`public/uploads/tickets/`). |

## Sistemas externos

| Sistema | Para qué se usa |
|---|---|
| **MariaDB** | Base de datos principal. También guarda las sesiones (tabla `sessions`). |
| **WhatsApp** | Desde la factura, el botón "Enviar WhatsApp" abre `wa.me` con el mensaje del recibo para el cliente. |
| **CDNs** | El navegador descarga de ahí Bootstrap, jQuery, DataTables, SweetAlert2, Font Awesome, Chart.js, y jsPDF y html2canvas para armar el PDF del recibo. El fondo del login viene de Unsplash. |
| **Servidor + PM2** | PM2 mantiene corriendo `src/app.js` como el proceso `ISP-Admin` en el puerto 4003. |
| **GitHub** | Guarda el código y el historial. El servidor trabaja sobre una copia de este repositorio. |

> **Nota:** el PDF del recibo se genera en el navegador del administrador, no en el servidor. Por eso depende de que los CDNs estén disponibles.
