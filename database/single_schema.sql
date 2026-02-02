-- Pet Shop Management System - Single Database, Single Company
-- PostgreSQL 12+

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
-- 2. BUSINESS ENTITIES (SIN empresa_id)
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

CREATE TABLE articulos_proveedor (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    codigo_proveedor VARCHAR(50),
    ultimo_costo DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producto_id, proveedor_id)
);

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

CREATE TABLE pagos_compra (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL REFERENCES compras_facturas(id) ON DELETE CASCADE,
    cuenta_pago_id INTEGER NOT NULL REFERENCES cuentas_pago(id) ON DELETE RESTRICT,
    monto DECIMAL(12, 2) NOT NULL,
    fecha_pago TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    referencia VARCHAR(100),
    notas TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
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

-- Prevention of deletion
CREATE OR REPLACE FUNCTION prevent_deletion_with_refs()
RETURNS TRIGGER AS $$
DECLARE 
    cnt INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'productos' THEN
        SELECT COUNT(*) INTO cnt FROM stock_movimientos WHERE producto_id = OLD.id;
        IF cnt > 0 THEN RAISE EXCEPTION 'Producto con movimientos'; END IF;
    ELSIF TG_TABLE_NAME = 'cuentas_pago' THEN
        SELECT COUNT(*) INTO cnt FROM fondos_movimientos WHERE cuenta_id = OLD.id;
        IF cnt > 0 THEN RAISE EXCEPTION 'Cuenta con movimientos'; END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_product_deletion BEFORE DELETE ON productos FOR EACH ROW EXECUTE FUNCTION prevent_deletion_with_refs();
CREATE TRIGGER trigger_prevent_account_deletion BEFORE DELETE ON cuentas_pago FOR EACH ROW EXECUTE FUNCTION prevent_deletion_with_refs();
