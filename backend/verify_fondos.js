// Script para aplicar migración a fondos_movimientos
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
        console.log('=== APLICANDO MIGRACION A FONDOS_MOVIMIENTOS ===\n');

        // Verificar si existe la columna motivo_id
        const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'fondos_movimientos' AND column_name = 'motivo_id'
        `);
        
        console.log('Columna motivo_id en fondos_movimientos:', colCheck.rows.length > 0 ? 'EXISTE' : 'NO EXISTE');

        if (colCheck.rows.length === 0) {
            // Crear tabla de motivos fondos
            await client.query(`
                CREATE TABLE IF NOT EXISTS fondos_motivos (
                    id SMALLINT PRIMARY KEY,
                    codigo CHAR(2) UNIQUE NOT NULL,
                    nombre VARCHAR(30) NOT NULL,
                    es_revertible BOOLEAN DEFAULT FALSE,
                    orden SMALLINT DEFAULT 0
                )
            `);
            console.log('✓ fondos_motivos creada');

            // Poblar fondos_motivos
            await client.query(`
                INSERT INTO fondos_motivos (id, codigo, nombre, es_revertible, orden) VALUES
                (1, 'VE', 'VENTA', TRUE, 10),
                (2, 'CO', 'COMPRA', TRUE, 20),
                (3, 'GS', 'GASTO', FALSE, 30),
                (4, 'DP', 'DEPOSITO', FALSE, 40),
                (5, 'RT', 'RETIRO', FALSE, 50),
                (6, 'AJ', 'AJUSTE', TRUE, 60),
                (7, 'AC', 'APERTURA_CAJA', FALSE, 70),
                (8, 'CC', 'CIERRE_CAJA', FALSE, 80),
                (9, 'CA', 'AJUSTE_CAJA', TRUE, 90)
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('✓ fondos_motivos poblada');

            // Agregar campos revertido
            await client.query(`ALTER TABLE fondos_movimientos ADD COLUMN IF NOT EXISTS revertido BOOLEAN DEFAULT FALSE`);
            await client.query(`ALTER TABLE fondos_movimientos ADD COLUMN IF NOT EXISTS revertido_fecha TIMESTAMP`);
            await client.query(`ALTER TABLE fondos_movimientos ADD COLUMN IF NOT EXISTS revertido_por INTEGER REFERENCES usuarios(id)`);
            await client.query(`ALTER TABLE fondos_movimientos ADD COLUMN IF NOT EXISTS revertido_motivo TEXT`);
            console.log('✓ Campos revertido agregados');

            // Agregar motivo_id
            await client.query(`ALTER TABLE fondos_movimientos ADD COLUMN IF NOT EXISTS motivo_id SMALLINT REFERENCES fondos_motivos(id)`);
            console.log('✓ motivo_id agregado');

            // Actualizar datos existentes
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 1 WHERE motivo = 'VENTA'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 2 WHERE motivo = 'COMPRA'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 3 WHERE motivo = 'GASTO'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 4 WHERE motivo = 'DEPOSITO'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 5 WHERE motivo = 'RETIRO'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 6 WHERE motivo = 'AJUSTE'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 7 WHERE motivo = 'APERTURA_CAJA'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 8 WHERE motivo = 'CIERRE_CAJA'`);
            await client.query(`UPDATE fondos_movimientos SET motivo_id = 9 WHERE motivo = 'AJUSTE_CAJA'`);
            console.log('✓ Datos actualizados');

            // Crear índices
            await client.query(`CREATE INDEX IF NOT EXISTS idx_fondos_movimientos_cuenta_fecha ON fondos_movimientos(cuenta_id, created_at DESC)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_fondos_movimientos_referencia ON fondos_movimientos(referencia_id, motivo_id) WHERE motivo_id IN (1, 2, 6, 9)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_fondos_movimientos_revertido ON fondos_movimientos(revertido, created_at DESC) WHERE revertido = FALSE`);
            console.log('✓ Índices creados');

            console.log('\n=== MIGRACION COMPLETADA ===');
        } else {
            console.log('Las columnas ya existen.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
