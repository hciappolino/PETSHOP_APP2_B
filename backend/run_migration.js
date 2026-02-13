// Script para ejecutar la migración de motivos
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'petshop',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('Conectando a la base de datos...');
        await client.query('SELECT NOW()');
        console.log('Conexion exitosa\n');

        // Leer el archivo de migración
        const migrationPath = path.resolve(__dirname, '../database/migrations/20260208_motivos_codigos_optimizacion.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Ejecutando migracion...\n');
        await client.query(migrationSQL);
        
        // Registrar la migración
        await client.query(
            'INSERT INTO migrations_log (filename) VALUES ($1)',
            ['20260208_motivos_codigos_optimizacion.sql']
        );
        
        console.log('Migracion ejecutada exitosamente!');
    } catch (error) {
        console.error('Error:', error.message);
        if (error.code === '23505') {
            console.log('\nNota: La migracion ya fue ejecutada.');
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main();
