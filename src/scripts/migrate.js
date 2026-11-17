const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config/database');

// Create connection pool
const pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});

async function runMigrations() {
    try {
        // Only run the latest migration
        const migrationsDir = path.join(__dirname, '../migrations');
        const files = fs.readdirSync(migrationsDir);
        
        // Get the latest migration file
        const latestMigration = files
            .filter(file => file.endsWith('.js'))
            .sort((a, b) => {
                const numA = parseInt(a.split('_')[0]);
                const numB = parseInt(b.split('_')[0]);
                return numA - numB;
            })
            .pop();

        if (latestMigration) {
            console.log(`Running latest migration: ${latestMigration}`);
            const migration = require(path.join(migrationsDir, latestMigration));
            await migration.up();
            console.log('Migration completed successfully!');
        } else {
            console.log('No migration files found');
        }
    } catch (error) {
        console.error('Error running migrations:', error);
        throw error;
    } finally {
        pool.end();
    }
}

runMigrations();
