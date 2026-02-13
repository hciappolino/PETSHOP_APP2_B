// Script para hacer el campo motivo nullable
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
        console.log('Haciendo campo motivo nullable...\n');

        // Hacer nullable el campo motivo en stock_movimientos
        await client.query(`ALTER TABLE stock_movimientos ALTER COLUMN motivo DROP NOT NULL`);
        console.log('✓ stock_movimientos.motivo ahora es nullable');

        // Hacer nullable el campo motivo en fondos_movimientos
        await client.query(`ALTER TABLE fondos_movimientos ALTER COLUMN motivo DROP NOT NULL`);
        console.log('✓ fondos_movimientos.motivo ahora es nullable');

        console.log('\n=== LISTO ===');
        console.log('Ahora puedes hacer ventas nuevamente.');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
