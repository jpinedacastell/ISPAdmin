const db = require('../config/database');

async function setupPlanes() {
    try {
        // Crear tabla de planes
        await db.query(`
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
            )
        `);
        console.log('✅ Tabla de planes creada correctamente');

        // Crear tabla de relación cliente_plan
        await db.query(`
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
            )
        `);
        console.log('✅ Tabla de cliente_plan creada correctamente');

        // Insertar planes de ejemplo
        const planesEjemplo = [
            ['Plan Básico', 10, 5, 29.99, 'Plan básico ideal para navegación y redes sociales'],
            ['Plan Estándar', 30, 15, 49.99, 'Plan intermedio para streaming y gaming casual'],
            ['Plan Premium', 100, 50, 79.99, 'Plan premium para gaming y trabajo remoto'],
            ['Plan Pro', 200, 100, 129.99, 'Plan profesional para empresas y streaming 4K']
        ];

        await db.query(`
            INSERT INTO planes (nombre, velocidad_descarga, velocidad_subida, precio, descripcion)
            VALUES ?
        `, [planesEjemplo]);
        
        console.log('✅ Datos de ejemplo insertados correctamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al configurar las tablas de planes:', error);
        process.exit(1);
    }
}

setupPlanes(); 