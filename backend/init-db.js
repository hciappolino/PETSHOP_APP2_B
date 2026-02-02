import { pool } from './config/db.js';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function initDatabase() {
    try {
        console.log('Iniciando inicialización de la base de datos...');
        
        // Leer scripts SQL
        const schemaPath = path.resolve(__dirname, '../database/single_schema.sql');
        const seedPath = path.resolve(__dirname, '../database/single_seed.sql');
        
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        
        // Ejecutar script de estructura
        console.log('Ejecutando script de estructura...');
        await pool.query(schemaSQL);
        console.log('Estructura de la base de datos creada');
        
        // Ejecutar script de datos iniciales
        console.log('Ejecutando script de datos iniciales...');
        await pool.query(seedSQL);
        console.log('Datos iniciales insertados');
        
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
