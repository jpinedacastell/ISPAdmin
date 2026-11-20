const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

async function runMigrations() {
    try {
        // Conectar a la base de datos
        const db = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // Obtener todas las migraciones
        const migrationsPath = path.join(__dirname, '..', 'migrations');
        const files = await fs.readdir(migrationsPath);
        const migrationFiles = files
            .filter(file => file.endsWith('.js'))
            .sort(); // Ordenar por nombre de archivo

        // Ejecutar cada migración
        for (const file of migrationFiles) {
            const migrationPath = path.join(migrationsPath, file);
            const migration = require(migrationPath);
            
            console.log(`Ejecutando migración: ${file}`);
            await migration.up(db);
            console.log(`Migración ${file} completada`);
        }

        console.log('Todas las migraciones completadas exitosamente');
    } catch (error) {
        console.error('Error al ejecutar migraciones:', error);
        process.exit(1);
    }
}

runMigrations();
