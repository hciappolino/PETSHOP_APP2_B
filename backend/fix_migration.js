// Script para eliminar el registro de migración fallida
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
    try {
        console.log('Conectando a la base de datos...');
        await pool.query('SELECT NOW()');
        console.log('✅ Conexión exitosa');

        // Eliminar el registro de la migración fallida
        const result = await pool.query(
            "DELETE FROM migrations_log WHERE filename = $1",
            ['20260208_motivos_codigos_optimizacion.sql']
        );

        console.log(`✅ Registro eliminado: ${result.rowCount} fila(s) afectada(s)`);
        console.log('\nAhora puedes reiniciar el backend para que ejecute la migración.');
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\nNota: Asegúrate de que PostgreSQL esté ejecutándose.');
        }
    } finally {
        await pool.end();
    }
}

main();
