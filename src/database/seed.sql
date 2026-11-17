USE isp_management;

-- Insertar planes de internet
INSERT INTO planes (nombre, velocidad_mbps, precio, descripcion) VALUES
('Plan Básico', 10, 299.99, 'Internet básico para navegación y redes sociales'),
('Plan Estándar', 20, 399.99, 'Internet para streaming y trabajo remoto'),
('Plan Premium', 50, 599.99, 'Internet de alta velocidad para gaming y trabajo pesado'),
('Plan Pro', 100, 899.99, 'Internet ultra rápido para profesionales y empresas'),
('Plan Fibra Elite', 200, 1499.99, 'Máxima velocidad disponible con fibra óptica'); 