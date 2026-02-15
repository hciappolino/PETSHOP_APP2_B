-- Migration: Permissions System
-- Date: 2026-02-14
-- Description: Replace hardcoded roles with granular permissions system

-- ============================================
-- 1. CREATE NEW TABLES
-- ============================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    es_sistema BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permisos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden INTEGER DEFAULT 0
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS rol_permisos (
    rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

-- ============================================
-- 2. POPULATE DEFAULT ROLES
-- ============================================

INSERT INTO roles (id, nombre, descripcion, es_sistema) VALUES
(1, 'admin', 'Administrador del sistema con acceso completo', true),
(2, 'vendedor', 'Vendedor con acceso al POS y caja', true)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to continue from 3
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles), true);

-- ============================================
-- 3. POPULATE ALL 35 PERMISSIONS
-- ============================================

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
('admin.empresas', 'admin', 'Gestionar empresas', 'Administrar empresas del sistema', 124)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- 4. ASSIGN PERMISSIONS TO ROLES
-- ============================================

-- Admin gets ALL permissions
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos
ON CONFLICT DO NOTHING;

-- Vendedor gets POS + Caja permissions
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos WHERE codigo IN (
    'pos.ver',
    'pos.vender',
    'caja.operar',
    'caja.reportes'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. ADD rol_id COLUMN TO usuarios TABLE
-- ============================================

DO $$
BEGIN
    -- Add rol_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'rol_id'
    ) THEN
        ALTER TABLE usuarios ADD COLUMN rol_id INTEGER;
    END IF;
END $$;

-- ============================================
-- 6. MIGRATE EXISTING USERS
-- ============================================

DO $$
BEGIN
    -- Check if old 'rol' column exists before migrating
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'rol'
    ) THEN
        -- Map admin users to admin role (id=1)
        UPDATE usuarios SET rol_id = 1 WHERE rol = 'admin';
        
        -- Map vendedor users to vendedor role (id=2)
        UPDATE usuarios SET rol_id = 2 WHERE rol = 'vendedor';
        
        -- Map gerente users to admin role (id=1) - promote to admin
        UPDATE usuarios SET rol_id = 1 WHERE rol = 'gerente';
        
        -- Set default for any NULL values
        UPDATE usuarios SET rol_id = 2 WHERE rol_id IS NULL;
    ELSE
        -- If rol column doesn't exist, set all users to vendedor by default
        UPDATE usuarios SET rol_id = 2 WHERE rol_id IS NULL;
    END IF;
END $$;

-- ============================================
-- 7. ADD CONSTRAINTS TO rol_id
-- ============================================

DO $$
BEGIN
    -- Make rol_id NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'rol_id' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE usuarios ALTER COLUMN rol_id SET NOT NULL;
    END IF;
    
    -- Set default value
    ALTER TABLE usuarios ALTER COLUMN rol_id SET DEFAULT 2;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'usuarios_rol_id_fkey' AND table_name = 'usuarios'
    ) THEN
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_id_fkey 
        FOREIGN KEY (rol_id) REFERENCES roles(id);
    END IF;
END $$;

-- ============================================
-- 8. DROP OLD rol COLUMN
-- ============================================

DO $$
BEGIN
    -- Drop the old rol column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'rol'
    ) THEN
        ALTER TABLE usuarios DROP COLUMN rol;
    END IF;
END $$;

-- ============================================
-- 9. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON permisos(modulo);
CREATE INDEX IF NOT EXISTS idx_permisos_codigo ON permisos(codigo);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
DECLARE
    role_count INTEGER;
    permission_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO role_count FROM roles;
    SELECT COUNT(*) INTO permission_count FROM permisos;
    SELECT COUNT(*) INTO user_count FROM usuarios WHERE rol_id IS NOT NULL;
    
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE '  - Roles created: %', role_count;
    RAISE NOTICE '  - Permissions created: %', permission_count;
    RAISE NOTICE '  - Users migrated: %', user_count;
END $$;
