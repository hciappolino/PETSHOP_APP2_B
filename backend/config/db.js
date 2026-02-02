import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connection configuration - support both Railway's DATABASE_URL and individual DB_* variables
const poolConfig = process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Railway's PostgreSQL
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'petshop_app',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

// Single connection pool for the entire application (Single DB Architecture)
const pool = new Pool(poolConfig);

pool.on('connect', () => {
    console.log('✓ Database connected successfully (Single DB Mode)');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
});

// Single pool - no tenant isolation needed for single company architecture

/**
 * Cierra el pool de conexiones
 */
export async function closeAllPools() {
    console.log('Closing database pool...');
    await pool.end();
}

export { pool };
export default pool;
