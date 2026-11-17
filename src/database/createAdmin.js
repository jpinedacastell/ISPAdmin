require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createDefaultAdmin() {
  try {
    // Crear conexión
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Generar hash del password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    // Insertar administrador
    const [result] = await connection.execute(
      'INSERT INTO administradores (usuario, password, nombre, email) VALUES (?, ?, ?, ?)',
      ['admin', passwordHash, 'Administrador', 'admin@isp.com']
    );

    console.log('Administrador creado exitosamente');
    console.log('Usuario: admin');
    console.log('Contraseña: admin123');

    await connection.end();
  } catch (error) {
    console.error('Error al crear administrador:', error);
  }
}

createDefaultAdmin(); 