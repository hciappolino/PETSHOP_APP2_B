-- Pet Shop Management System - Single Database, Single Company
-- PostgreSQL 12+

-- ============================================
-- 0. CLEANUP (FOR INITIAL SETUP)
-- ============================================
DROP TABLE IF EXISTS fondos_movimientos CASCADE;
DROP TABLE IF EXISTS stock_movimientos CASCADE;
DROP TABLE IF EXISTS fondos_motivos CASCADE;
DROP TABLE IF EXISTS stock_motivos CASCADE;
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
DROP TABLE IF EXISTS rol_permisos CASCADE;
DROP TABLE IF EXISTS permisos CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================
-- 1. ROLES AND PERMISSIONS
-- ============================================

-- Roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    es_sistema BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE permisos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden INTEGER DEFAULT 0
);

-- Role-Permission junction table
CREATE TABLE rol_permisos (
    rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

-- Populate default roles
INSERT INTO roles (id, nombre, descripcion, es_sistema) VALUES
(1, 'admin', 'Administrador del sistema con acceso completo', true),
(2, 'vendedor', 'Vendedor con acceso al POS y caja', true);

-- Reset sequence to continue from 3
SELECT setval('roles_id_seq', 2, true);

-- Populate all 35 permissions
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
-- POS module
('pos.ver', 'pos', 'Ver punto de venta', 'Acceder al punto de venta', 10),
('pos.vender', 'pos', 'Realizar ventas', 'Crear ventas desde el POS', 11),
('pos.cancelar', 'pos', 'Cancelar ventas', 'Cancelar ventas realizadas', 12),

-- Caja module
('caja.operar', 'caja', 'Operar caja', 'Abrir y cerrar sesiones de caja', 20),
('caja.reportes', 'caja', 'Reportes de caja', 'Ver reportes de caja diaria', 21),

-- Productos module
('productos.ver', 'productos', 'Ver productos', 'Ver listado de productos', 30),
('productos.crear', 'productos', 'Crear productos', 'Crear nuevos productos', 31),
('productos.editar', 'productos', 'Editar productos', 'Modificar productos existentes', 32),
('productos.eliminar', 'productos', 'Eliminar productos', 'Eliminar productos del sistema', 33),

-- Stock module
('stock.ver', 'stock', 'Ver movimientos de stock', 'Ver historial de movimientos', 40),
('stock.ajustar', 'stock', 'Ajustar stock', 'Realizar ajustes manuales de stock', 41),
('stock.granel', 'stock', 'Inspección granel', 'Inspeccionar y abrir bolsas de granel', 42),

-- Precios module
('precios.ver', 'precios', 'Ver precios', 'Ver listas de precios', 50),
('precios.editar', 'precios', 'Editar precios', 'Modificar precios de productos', 51),

-- Promociones module
('promociones.ver', 'promociones', 'Ver promociones', 'Ver promociones activas', 60),
('promociones.crear', 'promociones', 'Crear promociones', 'Crear nuevas promociones', 61),
('promociones.editar', 'promociones', 'Editar promociones', 'Modificar o cancelar promociones', 62),

-- Clientes module
('clientes.ver', 'clientes', 'Ver clientes', 'Ver listado de clientes', 70),
('clientes.crear', 'clientes', 'Crear clientes', 'Crear nuevos clientes', 71),
('clientes.editar', 'clientes', 'Editar clientes', 'Modificar datos de clientes', 72),
('clientes.eliminar', 'clientes', 'Eliminar clientes', 'Eliminar clientes del sistema', 73),
('clientes.cc', 'clientes', 'Cuenta corriente', 'Ver deudores y cuenta corriente', 74),

-- Proveedores module
('proveedores.ver', 'proveedores', 'Ver proveedores', 'Ver listado de proveedores', 80),
('proveedores.crear', 'proveedores', 'Crear proveedores', 'Crear nuevos proveedores', 81),
('proveedores.editar', 'proveedores', 'Editar proveedores', 'Modificar datos de proveedores', 82),

-- Compras module
('compras.ver', 'compras', 'Ver compras', 'Ver listado de compras', 90),
('compras.crear', 'compras', 'Registrar compras', 'Registrar compras a proveedores', 91),
('compras.gastos', 'compras', 'Registrar gastos', 'Registrar gastos y servicios', 92),

-- Fondos module
('fondos.ver', 'fondos', 'Ver fondos', 'Ver cuentas y movimientos de fondos', 100),
('fondos.mover', 'fondos', 'Mover fondos', 'Transferir entre cuentas', 101),
('fondos.cuentas', 'fondos', 'Administrar cuentas', 'Crear y editar cuentas de pago', 102),

-- Reportes module
('reportes.ventas', 'reportes', 'Reportes de ventas', 'Ver reportes de ventas', 110),
('reportes.stock', 'reportes', 'Reportes de stock', 'Ver reportes de stock mínimo', 111),
('reportes.ganancias', 'reportes', 'Reportes de ganancias', 'Ver reportes de ganancias estimadas', 112),

-- Admin module
('admin.usuarios', 'admin', 'Gestionar usuarios', 'Crear, editar y eliminar usuarios', 120),
('admin.roles', 'admin', 'Gestionar roles', 'Crear y editar roles y permisos', 121),
('admin.backups', 'admin', 'Gestionar backups', 'Crear y restaurar backups', 122),
('admin.initdb', 'admin', 'Base de datos', 'Inicializar o reiniciar base de datos', 123),
('admin.empresas', 'admin', 'Gestionar empresas', 'Administrar empresas del sistema', 124);

-- Assign all permissions to admin role
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos;

-- Assign POS + Caja permissions to vendedor role
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos WHERE codigo IN (
    'pos.ver',
    'pos.vender',
    'caja.operar',
    'caja.reportes'
);

-- Create indexes for permissions system
CREATE INDEX idx_permisos_modulo ON permisos(modulo);
CREATE INDEX idx_permisos_codigo ON permisos(codigo);

-- ============================================
-- 2. USERS
-- ============================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    rol_id INTEGER NOT NULL DEFAULT 2 REFERENCES roles(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_rol_id ON usuarios(rol_id);

-- ============================================
-- 3. BUSINESS ENTITIES (SIN empresa_id)
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
    es_caja_operativa BOOLEAN DEFAULT false,
    es_caja_fondo BOOLEAN DEFAULT false,
    visible_pos BOOLEAN DEFAULT true,
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
    descuento_total DECIMAL(12, 2) DEFAULT 0.00,
    cuenta_pago_id INTEGER REFERENCES cuentas_pago(id),
    sesion_caja_id INTEGER REFERENCES sesiones_caja(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    tipo_venta VARCHAR(20) DEFAULT 'CONTADO' CHECK (tipo_venta IN ('CONTADO', 'CUENTA_CORRIENTE')),
    cancelada BOOLEAN DEFAULT false,
    cancelada_fecha TIMESTAMP,
    cancelada_usuario_id INTEGER REFERENCES usuarios(id),
    cancelada_motivo TEXT,
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

CREATE TABLE stock_motivos (
    id SMALLINT PRIMARY KEY,
    codigo CHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(30) NOT NULL,
    es_revertible BOOLEAN DEFAULT FALSE,
    orden SMALLINT DEFAULT 0
);

CREATE TABLE fondos_motivos (
    id SMALLINT PRIMARY KEY,
    codigo CHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(30) NOT NULL,
    es_revertible BOOLEAN DEFAULT FALSE,
    orden SMALLINT DEFAULT 0
);

INSERT INTO stock_motivos (id, codigo, nombre, es_revertible, orden) VALUES
(1, 'VE', 'VENTA', TRUE, 10),
(2, 'CO', 'COMPRA', FALSE, 20),
(3, 'AJ', 'AJUSTE', TRUE, 30),
(4, 'AB', 'APERTURA_BOLSA', TRUE, 40),
(5, 'DE', 'DEVOLUCION', FALSE, 50);

INSERT INTO fondos_motivos (id, codigo, nombre, es_revertible, orden) VALUES
(1, 'VE', 'VENTA', TRUE, 10),
(2, 'CO', 'COMPRA', TRUE, 20),
(3, 'GS', 'GASTO', FALSE, 30),
(4, 'DP', 'DEPOSITO', FALSE, 40),
(5, 'RT', 'RETIRO', FALSE, 50),
(6, 'AJ', 'AJUSTE', TRUE, 60),
(7, 'AC', 'APERTURA_CAJA', FALSE, 70),
(8, 'CC', 'CIERRE_CAJA', FALSE, 80),
(9, 'CA', 'AJUSTE_CAJA', TRUE, 90);

CREATE TABLE stock_movimientos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    cantidad DECIMAL(12, 3) NOT NULL,
    motivo_id SMALLINT NOT NULL REFERENCES stock_motivos(id),
    referencia_id INTEGER,
    stock_anterior DECIMAL(12, 3),
    stock_nuevo DECIMAL(12, 3),
    usuario_id INTEGER REFERENCES usuarios(id),
    notas TEXT,
    revertido BOOLEAN DEFAULT FALSE,
    revertido_fecha TIMESTAMP,
    revertido_por INTEGER REFERENCES usuarios(id),
    revertido_motivo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fondos_movimientos (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER NOT NULL REFERENCES cuentas_pago(id) ON DELETE RESTRICT,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto DECIMAL(12, 2) NOT NULL,
    motivo_id SMALLINT NOT NULL REFERENCES fondos_motivos(id),
    referencia_id INTEGER,
    sesion_caja_id INTEGER REFERENCES sesiones_caja(id),
    saldo_anterior DECIMAL(12, 2),
    saldo_nuevo DECIMAL(12, 2),
    usuario_id INTEGER REFERENCES usuarios(id),
    descripcion TEXT,
    revertido BOOLEAN DEFAULT FALSE,
    revertido_fecha TIMESTAMP,
    revertido_por INTEGER REFERENCES usuarios(id),
    revertido_motivo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_movimientos_producto_fecha ON stock_movimientos(producto_id, created_at DESC);
CREATE INDEX idx_stock_movimientos_referencia ON stock_movimientos(referencia_id, motivo_id) WHERE motivo_id IN (1, 3);
CREATE INDEX idx_stock_movimientos_revertido ON stock_movimientos(revertido, created_at DESC) WHERE revertido = FALSE;

CREATE INDEX idx_fondos_movimientos_cuenta_fecha ON fondos_movimientos(cuenta_id, created_at DESC);
CREATE INDEX idx_fondos_movimientos_referencia ON fondos_movimientos(referencia_id, motivo_id) WHERE motivo_id IN (1, 2, 6, 9);
CREATE INDEX idx_fondos_movimientos_revertido ON fondos_movimientos(revertido, created_at DESC) WHERE revertido = FALSE;

-- ============================================
-- 4. TRIGGERS
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

-- ============================================
-- 5. PROMOTIONS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS promociones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(20) NOT NULL DEFAULT 'porcentaje' CHECK (tipo IN ('porcentaje', 'bogo', 'precio_fijo', 'b2g', 'cantidad')),
    valor_descuento DECIMAL(10, 2) DEFAULT 0.00,
    ambito_aplicacion VARCHAR(20) NOT NULL DEFAULT 'producto' CHECK (ambito_aplicacion IN ('producto', 'categoria', 'marca', 'fabricante', 'carrito', 'cliente')),
    entidad_id INTEGER,
    entidad_nombre VARCHAR(100),
    cantidad_minima INTEGER DEFAULT 1,
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    activo BOOLEAN DEFAULT true,
    uso_maximo INTEGER,
    uso_actual INTEGER DEFAULT 0,
    prioridad INTEGER DEFAULT 0,
    stackeable BOOLEAN DEFAULT false,
    usuario_crea_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promocion_usos (
    id SERIAL PRIMARY KEY,
    promocion_id INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    descuento_aplicado DECIMAL(12, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promocion_condiciones (
    id SERIAL PRIMARY KEY,
    promocion_id INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    tipo_condicion VARCHAR(30) NOT NULL,
    valor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promociones_activas ON promociones(activo) WHERE activo = true;
CREATE INDEX idx_promociones_fechas ON promociones(fecha_inicio, fecha_fin);
CREATE INDEX idx_promocion_usos_promocion_id ON promocion_usos(promocion_id);

-- Trigger for promociones timestamp
CREATE TRIGGER trigger_update_promociones_timestamp BEFORE UPDATE ON promociones FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- 6. PREVENTION OF DELETION
-- ============================================

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
