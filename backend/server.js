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
import initRoutes from './routes/init-simple.js';
import usuariosRoutes from './routes/usuarios.js';
import promocionesRoutes from './routes/promociones.js';

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

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'OK',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            database: 'disconnected',
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
        // Check if database has any tables
        const result = await pool.query(`
            SELECT count(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        if (result.rows[0].table_count === 0) {
            console.log('Base de datos vacía, inicializando...');
            
            // Leer y ejecutar scripts SQL
            const fs = await import('fs');
            const path = await import('path');
            
            const schemaPath = path.resolve(__dirname, '../database/single_schema.sql');
            const seedPath = path.resolve(__dirname, '../database/single_seed.sql');
            
            const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
            const seedSQL = fs.readFileSync(seedPath, 'utf8');
            
            await pool.query(schemaSQL);
            console.log('Estructura de la base de datos creada');
            
            await pool.query(seedSQL);
            console.log('Datos iniciales insertados');
            
            console.log('Base de datos inicializada correctamente');
        } else {
            console.log('Base de datos ya inicializada');
        }
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
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
