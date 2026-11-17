require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setupAdmin() {
  try {
    // Crear conexión
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Crear tabla de administradores
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS administradores (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    console.log('Tabla de administradores creada exitosamente');

    // Verificar si ya existe un administrador
    const [admins] = await connection.execute('SELECT * FROM administradores WHERE usuario = ?', ['admin']);
    
    if (admins.length === 0) {
      // Generar hash del password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);

      // Insertar administrador
      await connection.execute(
        'INSERT INTO administradores (usuario, password, nombre, email) VALUES (?, ?, ?, ?)',
        ['admin', passwordHash, 'Administrador', 'admin@isp.com']
      );

      console.log('Administrador creado exitosamente');
      console.log('Usuario: admin');
      console.log('Contraseña: admin123');
    } else {
      console.log('El administrador ya existe');
    }

    await connection.end();
  } catch (error) {
    console.error('Error en la configuración:', error);
  }
}

setupAdmin(); 