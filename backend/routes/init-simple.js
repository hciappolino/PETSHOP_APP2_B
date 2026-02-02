import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

// Script de estructura simplificado
const schemaSQL = `
-- ============================================
-- 0. CLEANUP (FOR INITIAL SETUP)
-- ============================================
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

-- ============================================
-- 1. USERS
-- ============================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    rol VARCHAR(20) NOT NULL DEFAULT 'vendedor' CHECK (rol IN ('admin', 'vendedor', 'gerente')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_username ON usuarios(username);

-- ============================================
-- 2. BUSINESS ENTITIES
-- ============================================

CREATE TABLE proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cuit VARCHAR(13),
    contacto VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    dni_cuit VARCHAR(13),
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    saldo_cc DECIMAL(12, 2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    codigo VARCHAR(50) UNIQUE,
    fabricante VARCHAR(100),
    marca VARCHAR(100),
    tipo_presentacion VARCHAR(10) NOT NULL CHECK (tipo_presentacion IN ('BOLSA', 'UNIDAD')),
    factor_conversion DECIMAL(10, 3) DEFAULT 1.000,
    costo_ultima_compra DECIMAL(12, 2) DEFAULT 0.00,
    stock_actual DECIMAL(12, 3) DEFAULT 0.000,
    stock_minimo DECIMAL(12, 3) DEFAULT 0.000,
    tipo_animal VARCHAR(20) DEFAULT 'OTROS' CHECK (tipo_animal IN ('GATO','PERRO','OTROS')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_productos_codigo ON productos(codigo);

CREATE TABLE listas_precios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    es_default BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lista_articulo (
    id SERIAL PRIMARY KEY,
    lista_precio_id INTEGER NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio_venta_unidad DECIMAL(12, 2) DEFAULT 0.00,
    precio_venta_granel DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lista_precio_id, producto_id)
);

CREATE TABLE cuentas_pago (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    tipo VARCHAR(20) CHECK (tipo IN ('EFECTIVO', 'BANCO', 'DIGITAL', 'EXTERNA')),
    saldo_actual DECIMAL(12, 2) DEFAULT 0.00,
    es_contabilizada BOOLEAN DEFAULT true,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sesiones_caja (
    id SERIAL PRIMARY KEY,
    estado VARCHAR(10) NOT NULL CHECK (estado IN ('ABIERTA', 'CERRADA')),
    apertura_fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cierre_fecha TIMESTAMP,
    saldo_apertura DECIMAL(12, 2) NOT NULL,
    saldo_cierre_esperado DECIMAL(12, 2),
    saldo_cierre_real DECIMAL(12, 2),
    diferencia DECIMAL(12, 2),
    usuario_apertura_id INTEGER REFERENCES usuarios(id),
    usuario_cierre_id INTEGER REFERENCES usuarios(id),
    notas TEXT
);

CREATE TABLE compras_facturas (
    id SERIAL PRIMARY KEY,
    proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    numero_factura VARCHAR(50),
    total DECIMAL(12, 2) DEFAULT 0.00,
    monto_pagado DECIMAL(12, 2) DEFAULT 0.00,
    pagado BOOLEAN DEFAULT false,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compras_renglones (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL REFERENCES compras_facturas(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE RESTRICT,
    descripcion VARCHAR(255),
    cantidad DECIMAL(12, 3) NOT NULL,
    precio_costo DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (cantidad * precio_costo) STORED
);

CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    lista_precio_id INTEGER REFERENCES listas_precios(id) ON DELETE SET NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(12, 2) DEFAULT 0.00,
    cuenta_pago_id INTEGER REFERENCES cuentas_pago(id),
    sesion_caja_id INTEGER REFERENCES sesiones_caja(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    tipo_venta VARCHAR(20) DEFAULT 'CONTADO' CHECK (tipo_venta IN ('CONTADO', 'CUENTA_CORRIENTE')),
    notas TEXT
);

CREATE TABLE venta_items (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad DECIMAL(12, 3) NOT NULL,
    precio_venta DECIMAL(12, 2) NOT NULL,
    es_granel BOOLEAN DEFAULT false,
    subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (cantidad * precio_venta) STORED
);

CREATE TABLE stock_movimientos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    cantidad DECIMAL(12, 3) NOT NULL,
    motivo VARCHAR(30) NOT NULL CHECK (motivo IN ('VENTA', 'COMPRA', 'AJUSTE', 'APERTURA_BOLSA', 'DEVOLUCION')),
    referencia_id INTEGER,
    stock_anterior DECIMAL(12, 3),
    stock_nuevo DECIMAL(12, 3),
    usuario_id INTEGER REFERENCES usuarios(id),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fondos_movimientos (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER NOT NULL REFERENCES cuentas_pago(id) ON DELETE RESTRICT,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto DECIMAL(12, 2) NOT NULL,
    motivo VARCHAR(30) NOT NULL CHECK (motivo IN ('VENTA', 'COMPRA', 'GASTO', 'DEPOSITO', 'RETIRO', 'AJUSTE')),
    referencia_id INTEGER,
    sesion_caja_id INTEGER REFERENCES sesiones_caja(id),
    saldo_anterior DECIMAL(12, 2),
    saldo_nuevo DECIMAL(12, 2),
    usuario_id INTEGER REFERENCES usuarios(id),
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_producto_timestamp BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Auto-update purchase invoice total
CREATE OR REPLACE FUNCTION update_compra_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE compras_facturas SET total = (SELECT COALESCE(SUM(subtotal), 0) FROM compras_renglones WHERE factura_id = COALESCE(NEW.factura_id, OLD.factura_id))
    WHERE id = COALESCE(NEW.factura_id, OLD.factura_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_compra_total AFTER INSERT OR UPDATE OR DELETE ON compras_renglones FOR EACH ROW EXECUTE FUNCTION update_compra_total();

-- Auto-update sale total
CREATE OR REPLACE FUNCTION update_venta_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ventas SET total = (SELECT COALESCE(SUM(subtotal), 0) FROM venta_items WHERE venta_id = COALESCE(NEW.venta_id, OLD.venta_id))
    WHERE id = COALESCE(NEW.venta_id, OLD.venta_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_venta_total AFTER INSERT OR UPDATE OR DELETE ON venta_items FOR EACH ROW EXECUTE FUNCTION update_venta_total();
`;

// Script de datos iniciales simplificado
const seedSQL = `
-- Initial Seed Data
-- 1. Create admin user (password: admin123)
-- Hash: $2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu
INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo) 
VALUES ('admin', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'Administrador', 'admin@petshop.com', 'admin', true);

-- 2. Create sample users
INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo) 
VALUES ('vendedor1', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'Juan Vendedor', 'juan@petshop.com', 'vendedor', true);

INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo) 
VALUES ('gerente', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'María Gerente', 'maria@petshop.com', 'gerente', true);

-- 3. Initial price lists
INSERT INTO listas_precios (nombre, descripcion, es_default, activo) 
VALUES ('Minorista', 'Lista de precios estándar', true, true);

-- 4. Payment accounts
INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, activo) 
VALUES ('Efectivo', 'EFECTIVO', 0.00, true);

INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, activo) 
VALUES ('Banco', 'BANCO', 0.00, true);

-- 5. Sample providers
INSERT INTO proveedores (nombre, cuit, contacto, telefono, email, direccion, activo)
VALUES ('Proveedor A', '20123456789', 'Juan', '5551234567', 'proveedor@a.com', 'Calle 1, 123', true);

-- 6. Sample clients
INSERT INTO clientes (nombre, dni_cuit, telefono, email, direccion, saldo_cc, activo)
VALUES ('Cliente Demo', '25987654321', '5559876543', 'cliente@demo.com', 'Avenida 10, 456', 0.00, true);

-- 7. Sample products
INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, costo_ultima_compra, stock_actual, stock_minimo, activo)
VALUES ('Alimento Perro Adulto 15kg', 'PERRO-ADL-15', 'Purina', 'Catchow', 'BOLSA', 'PERRO', 1.000, 2500.00, 10, 2, true);

INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, costo_ultima_compra, stock_actual, stock_minimo, activo)
VALUES ('Alimento Gato Adulto 7kg', 'GATO-ADL-7', 'Purina', 'Gatomax', 'BOLSA', 'GATO', 1.000, 1800.00, 15, 3, true);

INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, costo_ultima_compra, stock_actual, stock_minimo, activo)
VALUES ('Juguete Pelota de Goma', 'JUG-PELOTA', 'Generic', 'FunPets', 'UNIDAD', 'OTROS', 1.000, 250.00, 50, 10, true);

-- 8. Add products to price list
INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
VALUES (1, 1, 4500.00, 3500.00);

INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
VALUES (1, 2, 3200.00, 2800.00);

INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
VALUES (1, 3, 500.00, 400.00);
`;

router.post('/init-db', async (req, res) => {
    try {
        const { withSeeds = true } = req.body;
        
        console.log('Iniciando inicialización de la base de datos desde API (versión simple)...');
        console.log(`Modo: ${withSeeds ? 'con datos de ejemplo' : 'base de datos vacía'}`);
        
        // Ejecutar script de estructura
        console.log('Ejecutando script de estructura...');
        await pool.query(schemaSQL);
        console.log('Estructura de la base de datos creada');
        
        if (withSeeds) {
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
