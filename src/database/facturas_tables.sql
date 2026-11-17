-- Eliminar tablas si existen (en orden inverso para respetar las dependencias)
DROP TABLE IF EXISTS facturas;
DROP TABLE IF EXISTS config_facturacion;

-- Tabla de configuración de facturación
CREATE TABLE config_facturacion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dia_generacion INT NOT NULL DEFAULT 1 COMMENT 'Día del mes para generar facturas',
    dias_vencimiento INT NOT NULL DEFAULT 15 COMMENT 'Días para vencimiento desde emisión',
    prefijo_factura VARCHAR(10) NOT NULL DEFAULT 'FAC-' COMMENT 'Prefijo para número de factura',
    ultimo_numero INT NOT NULL DEFAULT 0 COMMENT 'Último número de factura generado',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de facturas
CREATE TABLE facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    plan_id INT NOT NULL,
    numero_factura VARCHAR(20) NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    mes_facturado DATE NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Monto en efectivo aplicado a la factura',
    pago_recibido DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Total efectivo recibido al cobrar la factura',
    credito_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor aplicado a la factura',
    abono_siguiente DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor generado para próximas facturas',
    estado ENUM('pendiente', 'pagada', 'vencida') NOT NULL DEFAULT 'pendiente',
    fecha_pago DATE NULL,
    metodo_pago VARCHAR(50) NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY unique_factura_mes (cliente_id, mes_facturado),
    INDEX idx_estado (estado),
    INDEX idx_fecha_emision (fecha_emision),
    INDEX idx_fecha_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración inicial si no existe
INSERT INTO config_facturacion (dia_generacion, dias_vencimiento, prefijo_factura, ultimo_numero)
SELECT 1, 15, 'FAC-', 0
WHERE NOT EXISTS (SELECT 1 FROM config_facturacion LIMIT 1); 
