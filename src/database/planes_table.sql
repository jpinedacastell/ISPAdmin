CREATE TABLE IF NOT EXISTS planes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    velocidad_descarga INT NOT NULL,
    velocidad_subida INT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de relación entre clientes y planes
CREATE TABLE IF NOT EXISTS cliente_plan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    plan_id INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE RESTRICT
);

-- Insertar algunos planes de ejemplo
INSERT INTO planes (nombre, velocidad_descarga, velocidad_subida, precio, descripcion) VALUES
('Plan Básico', 10, 5, 29.99, 'Plan básico ideal para navegación y redes sociales'),
('Plan Estándar', 30, 15, 49.99, 'Plan intermedio para streaming y gaming casual'),
('Plan Premium', 100, 50, 79.99, 'Plan premium para gaming y trabajo remoto'),
('Plan Pro', 200, 100, 129.99, 'Plan profesional para empresas y streaming 4K'); 