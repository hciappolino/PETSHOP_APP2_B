import { Router } from 'express';
import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

const router = Router();

router.post('/init-db', async (req, res) => {
    try {
        const { withSeeds = true } = req.body;
        
        console.log('Iniciando inicialización de la base de datos desde API...');
        console.log(`Modo: ${withSeeds ? 'con datos de ejemplo' : 'base de datos vacía'}`);
        
        // Leer scripts SQL
        const schemaPath = path.resolve(__dirname, '../../database/single_schema.sql');
        const seedPath = path.resolve(__dirname, '../../database/single_seed.sql');
        
        console.log('Verificando archivos SQL:', schemaPath, seedPath);
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error('Archivo single_schema.sql no encontrado');
        }
        if (withSeeds && !fs.existsSync(seedPath)) {
            throw new Error('Archivo single_seed.sql no encontrado');
        }
        
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Scripts SQL leídos correctamente');
        
        // Ejecutar script de estructura
        console.log('Ejecutando script de estructura...');
        await pool.query(schemaSQL);
        console.log('Estructura de la base de datos creada');
        
        if (withSeeds) {
            const seedSQL = fs.readFileSync(seedPath, 'utf8');
            // Ejecutar script de datos iniciales
            console.log('Ejecutando script de datos iniciales...');
            await pool.query(seedSQL);
            console.log('Datos iniciales insertados');
        }
        
        // Verificar usuarios
        const usersResult = await pool.query('SELECT id, username, email, rol FROM usuarios');
        const productsResult = await pool.query('SELECT id, nombre, codigo, stock_actual FROM productos');
        
        res.json({
            success: true,
            message: withSeeds ? 'Base de datos inicializada correctamente con datos de ejemplo' : 'Base de datos vacía creada correctamente',
            data: {
                usuarios: usersResult.rows.length,
                productos: productsResult.rows.length
            }
        });
        
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al inicializar la base de datos',
            error: error.message,
            stack: error.stack,
            details: error
        });
    }
});

// Endpoint to drop all tables (warning: destructive operation)
router.post('/drop-db', async (req, res) => {
    try {
        console.log('Eliminando todas las tablas de la base de datos...');
        
        // Drop all tables (using the same order as in schemaSQL for dependencies)
        await pool.query(`
            DROP TABLE IF EXISTS fondos_movimientos CASCADE;
            DROP TABLE IF EXISTS stock_movimientos CASCADE;
            DROP TABLE IF EXISTS venta_items CASCADE;
            DROP TABLE IF EXISTS ventas CASCADE;
            DROP TABLE IF EXISTS compras_renglones CASCADE;
            DROP TABLE IF EXISTS compras_facturas CASCADE;
            DROP TABLE IF EXISTS lista_articulo CASCADE;
            DROP TABLE IF EXISTS listas_precios CASCADE;
            DROP TABLE IF EXISTS articulos_proveedor CASCADE;
            DROP TABLE IF EXISTS productos CASCADE;
            DROP TABLE IF EXISTS clientes CASCADE;
            DROP TABLE IF EXISTS proveedores CASCADE;
            DROP TABLE IF EXISTS sesiones_caja CASCADE;
            DROP TABLE IF EXISTS cuentas_pago CASCADE;
            DROP TABLE IF EXISTS usuarios CASCADE;
        `);
        
        console.log('Todas las tablas eliminadas correctamente');
        
        res.json({
            success: true,
            message: 'Base de datos eliminada correctamente'
        });
        
    } catch (error) {
        console.error('Error al eliminar la base de datos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar la base de datos',
            error: error.message
        });
    }
});

router.get('/check-db', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT count(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        res.json({
            success: true,
            table_count: result.rows[0].table_count
        });
    } catch (error) {
        console.error('Error al verificar base de datos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar base de datos',
            error: error.message
        });
    }
});

export default router;
