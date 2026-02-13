// Script para verificar y aplicar la migración manualmente
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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
        console.log('=== VERIFICANDO BASE DE DATOS ===\n');

        // Verificar si existe la columna motivo_id
        const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'stock_movimientos' AND column_name = 'motivo_id'
        `);
        
        console.log('Columna motivo_id en stock_movimientos:', colCheck.rows.length > 0 ? 'EXISTE' : 'NO EXISTE');

        if (colCheck.rows.length === 0) {
            console.log('\nAGREGANDO COLUMNAS MANUALMENTE...\n');

            // Crear tabla de motivos stock
            await client.query(`
                CREATE TABLE IF NOT EXISTS stock_motivos (
                    id SMALLINT PRIMARY KEY,
                    codigo CHAR(2) UNIQUE NOT NULL,
                    nombre VARCHAR(30) NOT NULL,
                    es_revertible BOOLEAN DEFAULT FALSE,
                    orden SMALLINT DEFAULT 0
                )
            `);
            console.log('✓ stock_motivos creada');

            // Poblar stock_motivos
            await client.query(`
                INSERT INTO stock_motivos (id, codigo, nombre, es_revertible, orden) VALUES
                (1, 'VE', 'VENTA', TRUE, 10),
                (2, 'CO', 'COMPRA', FALSE, 20),
                (3, 'AJ', 'AJUSTE', TRUE, 30),
                (4, 'AB', 'APERTURA_BOLSA', TRUE, 40),
                (5, 'DE', 'DEVOLUCION', FALSE, 50)
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('✓ stock_motivos poblada');

            // Agregar campos revertido
            await client.query(`ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS revertido BOOLEAN DEFAULT FALSE`);
            await client.query(`ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS revertido_fecha TIMESTAMP`);
            await client.query(`ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS revertido_por INTEGER REFERENCES usuarios(id)`);
            await client.query(`ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS revertido_motivo TEXT`);
            console.log('✓ Campos revertido agregados');

            // Agregar motivo_id
            await client.query(`ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS motivo_id SMALLINT REFERENCES stock_motivos(id)`);
            console.log('✓ motivo_id agregado');

            // Actualizar datos existentes
            await client.query(`UPDATE stock_movimientos SET motivo_id = 1 WHERE motivo = 'VENTA'`);
            await client.query(`UPDATE stock_movimientos SET motivo_id = 2 WHERE motivo = 'COMPRA'`);
            await client.query(`UPDATE stock_movimientos SET motivo_id = 3 WHERE motivo = 'AJUSTE'`);
            await client.query(`UPDATE stock_movimientos SET motivo_id = 4 WHERE motivo = 'APERTURA_BOLSA'`);
            await client.query(`UPDATE stock_movimientos SET motivo_id = 5 WHERE motivo = 'DEVOLUCION'`);
            console.log('✓ Datos actualizados');

            // Crear índices
            await client.query(`CREATE INDEX IF NOT EXISTS idx_stock_movimientos_producto_fecha ON stock_movimientos(producto_id, created_at DESC)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_stock_movimientos_referencia ON stock_movimientos(referencia_id, motivo_id) WHERE motivo_id IN (1, 3)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_stock_movimientos_revertido ON stock_movimientos(revertido, created_at DESC) WHERE revertido = FALSE`);
            console.log('✓ Índices creados');

            console.log('\n=== MIGRACION MANUAL COMPLETADA ===');
        } else {
            console.log('\nLas columnas ya existen. La migración ya fue aplicada.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
