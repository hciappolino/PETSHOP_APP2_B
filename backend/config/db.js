import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer backend/.env, if not present fallback to project root .env
const envCandidates = [
    path.resolve(__dirname, '../.env'),   // backend/.env
    path.resolve(__dirname, '../../.env') // root .env
];

const envPath = envCandidates.find(p => fs.existsSync(p));
if (envPath) {
    dotenv.config({ path: envPath });
    console.log(`Loaded env from ${envPath}`);
} else {
    dotenv.config();
    console.warn('No .env file found in backend/ or project root; using process.env or defaults');
}

const { Pool } = pg;

// Connection configuration using environment variables
const poolConfig = {
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
