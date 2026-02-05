import { pool } from './config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
    
    // Get list of migration files sorted by name
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    
    // Get already executed migrations
    const result = await pool.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migrations_log'"
    );
    
    let alreadyRun = [];
    if (result.rows.length > 0) {
        const logResult = await pool.query('SELECT filename FROM migrations_log');
        alreadyRun = logResult.rows.map(r => r.filename);
    } else {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations_log (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
    
    // Run new migrations
    for (const file of files) {
        if (!alreadyRun.includes(file)) {
            console.log(`Ejecutando migración: ${file}`);
            const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await pool.query(migrationSQL);
            await pool.query('INSERT INTO migrations_log (filename) VALUES ($1)', [file]);
            console.log(`Migración ${file} completada`);
        } else {
            console.log(`Migración ${file} ya ejecutada`);
        }
    }
}

async function initDatabase() {
    try {
        console.log('Iniciando inicialización de la base de datos...');
        
        // Leer scripts SQL
        const schemaPath = path.resolve(__dirname, '../database/single_schema.sql');
        const withSeeds = process.env.INIT_WITH_SEEDS === 'true';
        const seedPath = withSeeds
            ? path.resolve(__dirname, '../database/single_seed.sql')
            : path.resolve(__dirname, '../database/single_seed_min.sql');
        
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        
        // Ejecutar script de estructura
        console.log('Ejecutando script de estructura...');
        await pool.query(schemaSQL);
        console.log('Estructura de la base de datos creada');
        
        // Ejecutar script de datos iniciales
        console.log(withSeeds ? 'Ejecutando datos de ejemplo...' : 'Ejecutando datos mínimos...');
        await pool.query(seedSQL);
        console.log('Datos iniciales insertados');
        
        // No ejecutar migraciones en una base nueva (el schema ya está actualizado)
        console.log('Base nueva: se omiten migraciones');
        
        console.log('Base de datos inicializada correctamente');
        
        // Verificar usuarios
        const usersResult = await pool.query('SELECT id, username, email, rol FROM usuarios');
        console.log('Usuarios creados:', usersResult.rows);
        
        // Verificar productos
        const productsResult = await pool.query('SELECT id, nombre, codigo, stock_actual FROM productos');
        console.log('Productos creados:', productsResult.rows);
        
        // Cerrar conexión
        process.exit(0);
        
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        process.exit(1);
    }
}

initDatabase();
