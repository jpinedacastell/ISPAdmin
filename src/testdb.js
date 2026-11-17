require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

console.log('Intentando conectar con:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('Error de conexión:', err);
    console.error('Código de error:', err.code);
    console.error('Número de error:', err.errno);
    console.error('SQL Estado:', err.sqlState);
    process.exit(1);
  }
  
  console.log('Conexión exitosa a la base de datos');
  
  // Probar una consulta simple
  connection.query('SHOW TABLES', (err, results) => {
    if (err) {
      console.error('Error al ejecutar consulta:', err);
    } else {
      console.log('Tablas en la base de datos:', results);
    }
    
    connection.end();
  });
}); 