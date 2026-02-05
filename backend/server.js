import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { verifyDatabaseStructure, getTableStats, ensureRequiredAccounts } from './db-verify.js';

// Import routes
import authRoutes from './routes/auth.js';
import empresasRoutes from './routes/empresas.js';
import proveedoresRoutes from './routes/proveedores.js';
import clientesRoutes from './routes/clientes.js';
import productosRoutes from './routes/productos.js';
import comprasRoutes from './routes/compras.js';
import ventasRoutes from './routes/ventas.js';
import cuentasPagoRoutes from './routes/cuentas_pago.js';
import sesionesCajaRoutes from './routes/sesiones_caja.js';
import stockMovimientosRoutes from './routes/stock_movimientos.js';
import fondosMovimientosRoutes from './routes/fondos_movimientos.js';
import listasPreciosRoutes from './routes/listas_precios.js';
import preciosRoutes from './routes/precios.js';
import reportesRoutes from './routes/reportes.js';
import debugRoutes from './routes/debug.js';
import initRoutes from './routes/init.js';
import usuariosRoutes from './routes/usuarios.js';
import promocionesRoutes from './routes/promociones.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Security middleware
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security: Helmet for secure HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
}));

// Security: Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? false : '*'),
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Flag to track if database is ready
let dbReady = false;
let dbInitializationError = null;

// Health check endpoint - waits for database to be ready
app.get('/health', async (req, res) => {
    const debugInfo = {
        timestamp: new Date().toISOString(),
        dbReady: dbReady,
        tables: [],
        tableCount: 0
    };
    
    try {
        // If not ready yet, try to initialize
        if (!dbReady) {
            console.log('[Health] DB not ready, attempting initialization...');
            await initializeDatabase();
        }
        
        if (dbInitializationError) {
            throw dbInitializationError;
        }
        
        // Get table list
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        debugInfo.tables = tablesResult.rows.map(r => r.table_name);
        debugInfo.tableCount = tablesResult.rows.length;
        
        res.json({
            status: 'OK',
            database: 'connected',
            initialized: dbReady,
            debug: debugInfo
        });
    } catch (error) {
        console.error('[Health] Error:', error.message);
        res.status(500).json({
            status: 'ERROR',
            database: 'disconnected',
            initialized: dbReady,
            debug: debugInfo,
            error: error.message
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/cuentas-pago', cuentasPagoRoutes);
app.use('/api/sesiones-caja', sesionesCajaRoutes);
app.use('/api/stock-movimientos', stockMovimientosRoutes);
app.use('/api/fondos-movimientos', fondosMovimientosRoutes);
app.use('/api/listas-precios', listasPreciosRoutes);
app.use('/api/precios', preciosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/init', initRoutes);
app.use('/api/promociones', promocionesRoutes);

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Ruta API no encontrada' });
});

// Function to initialize database
async function initializeDatabase() {
    try {
        console.log('[InitDB] Verificando estado de la base de datos...');
        
        // Check if database has any tables
        const result = await pool.query(`
            SELECT count(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        const tableCount = parseInt(result.rows[0].table_count);
        console.log(`[InitDB] Tablas encontradas: ${tableCount}`);

        // Consider DB initialized only if core tables exist
        const coreCheck = await pool.query(`
            SELECT EXISTS(
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'usuarios'
            ) AS has_core
        `);
        const hasCore = coreCheck.rows[0].has_core === true;
        const isEmpty = !hasCore;

        if (isEmpty) {
            console.log('[InitDB] Base de datos vacía, inicializando estructura...');
            
            const schemaPath = path.resolve(__dirname, '../database/single_schema.sql');
            const seedPath = path.resolve(__dirname, '../database/single_seed_min.sql');
            
            console.log(`[InitDB] Leyendo schema de: ${schemaPath}`);
            const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
            
            console.log('[InitDB] Ejecutando schema...');
            await pool.query(schemaSQL);
            console.log('[InitDB] Estructura de la base de datos creada');
            
            console.log('[InitDB] Insertando datos iniciales...');
            const seedSQL = fs.readFileSync(seedPath, 'utf8');
            await pool.query(seedSQL);
            console.log('[InitDB] Datos iniciales insertados');
        } else {
            console.log('[InitDB] Base de datos ya tiene tablas, verificando migraciones...');
        }
        
        // Run migrations if any exist (also for new DB after schema)
        const migrationsDir = path.resolve(__dirname, '../database/migrations');
        const migrationFiles = fs.existsSync(migrationsDir)
            ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
            : [];
        if (migrationFiles.length > 0) {
            console.log('[InitDB] Ejecutando migraciones...');
            await runMigrations();
        } else {
            console.log('[InitDB] Sin migraciones pendientes');
        }
        
        // Fix: Ensure view has marca_nombre and fabricante_nombre
        await fixPromocionesView();

        // Backfill verification: count promos missing entidad_nombre for marca/fabricante
        try {
            const missingEntidadNombre = await pool.query(`
                SELECT COUNT(*) AS total
                FROM promociones
                WHERE ambito_aplicacion IN ('marca', 'fabricante')
                  AND (entidad_nombre IS NULL OR entidad_nombre = '')
            `);
            console.log(`[InitDB] Promos marca/fabricante sin entidad_nombre: ${missingEntidadNombre.rows[0].total}`);
        } catch (error) {
            console.warn('[InitDB] Warning: No se pudo verificar entidad_nombre en promociones:', error.message);
        }
        
        // Mark as ready
        dbReady = true;
        console.log('[InitDB] Base de datos lista ✓');
        
    } catch (error) {
        console.error('[InitDB] Error al inicializar la base de datos:', error.message);
        dbInitializationError = error;
        throw error;
    }
}

// Function to run migrations
async function runMigrations() {
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
    
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    
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

// Fix: Ensure v_promociones_actuales view has marca_nombre, fabricante_nombre, entidad_nombre
async function fixPromocionesView() {
    try {
        const result = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'v_promociones_actuales' 
              AND column_name IN ('marca_nombre', 'fabricante_nombre', 'entidad_nombre')
        `);
        
        const hasMarca = result.rows.some(r => r.column_name === 'marca_nombre');
        const hasFabricante = result.rows.some(r => r.column_name === 'fabricante_nombre');
        const hasEntidadNombre = result.rows.some(r => r.column_name === 'entidad_nombre');
        
        if (!hasMarca || !hasFabricante || !hasEntidadNombre) {
            console.log('[InitDB] Corrigiendo vista v_promociones_actuales...');
            await pool.query(`
                CREATE OR REPLACE VIEW v_promociones_actuales AS
                SELECT 
                    p.*,
                    pr.nombre as producto_nombre,
                    lp.nombre as categoria_nombre,
                    pr.marca as marca_nombre,
                    pr.fabricante as fabricante_nombre,
                    p.entidad_nombre as entidad_nombre
                FROM promociones p
                LEFT JOIN productos pr ON p.ambito_aplicacion = 'producto' AND p.entidad_id = pr.id
                LEFT JOIN listas_precios lp ON p.ambito_aplicacion = 'categoria' AND p.entidad_id = lp.id
                WHERE p.activo = true
                  AND (p.fecha_fin IS NULL OR p.fecha_fin > CURRENT_TIMESTAMP)
                  AND (p.uso_maximo IS NULL OR p.uso_actual < p.uso_maximo)
            `);
            console.log('[InitDB] Vista v_promociones_actuales actualizada ✓');
        } else {
            console.log('[InitDB] Vista v_promociones_actuales OK');
        }
    } catch (error) {
        console.warn('[InitDB] Warning: No se pudo corregir la vista de promociones:', error.message);
    }
}

// Start server
app.listen(PORT, async () => {
    // Initialize database if needed
    await initializeDatabase();
    
    // Verify database structure on startup
    const dbOk = await verifyDatabaseStructure();
    
    if (dbOk) {
        await getTableStats();
        await ensureRequiredAccounts();
    }

    console.log(`
╔═══════════════════════════════════════════════════════╗
║   🐾 Pet Shop Management System - Backend API 🐾    ║
╠═══════════════════════════════════════════════════════╣
║   Server running on: http://localhost:${PORT}         ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   Database: ${process.env.DB_NAME || 'petshop_app'}                       ║
║   DB Status: ${dbOk ? '✅ OK' : '⚠️  PROBLEMAS'}                              ║
╚═══════════════════════════════════════════════════════╝
    `);
});

export default app;
