-- Migration: Add promociones tables for discount management
-- Run with: psql -U <user> -d <db> -f 20260203_add_promociones.sql

BEGIN;

-- ============================================
-- 1. PROMOTIONS TABLE (Main table)
-- ============================================
CREATE TABLE IF NOT EXISTS promociones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    -- Promotion type: 'porcentaje', 'bogo', 'precio_fijo', 'b2g' (buy 2 get)
    tipo VARCHAR(20) NOT NULL DEFAULT 'porcentaje' CHECK (tipo IN ('porcentaje', 'bogo', 'precio_fijo', 'b2g', 'cantidad')),
    
    -- Discount value: percentage (10 = 10%) or fixed price or quantity
    valor_descuento DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Application scope: 'producto', 'categoria', 'marca', 'fabricante', 'carrito', 'cliente'
    ambito_aplicacion VARCHAR(20) NOT NULL DEFAULT 'producto' CHECK (ambito_aplicacion IN ('producto', 'categoria', 'marca', 'fabricante', 'carrito', 'cliente')),
    
    -- Reference ID based on ambito_aplicacion
    entidad_id INTEGER,
    
    -- For BOGO/B2G: how many needed to buy
    cantidad_minima INTEGER DEFAULT 1,
    
    -- Date range
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    
    -- Activation
    activo BOOLEAN DEFAULT true,
    
    -- Usage limits
    uso_maximo INTEGER,  -- NULL = unlimited
    uso_actual INTEGER DEFAULT 0,
    
    -- Priority for stacking (higher = applied first)
    prioridad INTEGER DEFAULT 0,
    
    -- Stackable with other promotions
    stackeable BOOLEAN DEFAULT false,
    
    -- Created by user
    usuario_crea_id INTEGER REFERENCES usuarios(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. PROMOTION USAGE TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS promocion_usos (
    id SERIAL PRIMARY KEY,
    promocion_id INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    descuento_aplicado DECIMAL(12, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promocion_usos_promocion_id ON promocion_usos(promocion_id);
CREATE INDEX idx_promocion_usos_venta_id ON promocion_usos(venta_id);

-- ============================================
-- 3. PROMOTION CONDITIONS (Advanced rules)
-- ============================================
CREATE TABLE IF NOT EXISTS promocion_condiciones (
    id SERIAL PRIMARY KEY,
    promocion_id INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    
    -- Condition type: 'minimo_compra', 'minimo_cantidad', 'categoria_cliente', 'dia_semana'
    tipo_condicion VARCHAR(30) NOT NULL,
    
    -- Value for the condition
    valor VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. INDICES FOR QUERIES
-- ============================================
CREATE INDEX idx_promociones_activas ON promociones(activo) WHERE activo = true;
CREATE INDEX idx_promociones_fechas ON promociones(fecha_inicio, fecha_fin);
CREATE INDEX idx_promociones_ambito ON promociones(ambito_aplicacion, entidad_id);

-- ============================================
-- 5. VIEWS FOR EASY QUERIES
-- ============================================
CREATE OR REPLACE VIEW v_promociones_actuales AS
SELECT 
    p.*,
    pr.nombre as producto_nombre,
    lp.nombre as categoria_nombre
FROM promociones p
LEFT JOIN productos pr ON p.ambito_aplicacion = 'producto' AND p.entidad_id = pr.id
LEFT JOIN listas_precios lp ON p.ambito_aplicacion = 'categoria' AND p.entidad_id = lp.id
WHERE p.activo = true
  AND (p.fecha_fin IS NULL OR p.fecha_fin > CURRENT_TIMESTAMP)
  AND (p.uso_maximo IS NULL OR p.uso_actual < p.uso_maximo);

-- ============================================
-- 6. FUNCTION TO GET ACTIVE PROMOTIONS FOR A PRODUCT
-- ============================================
CREATE OR REPLACE FUNCTION fn_get_promociones_producto(p_producto_id INTEGER)
RETURNS TABLE (
    promocion_id INTEGER,
    nombre VARCHAR(100),
    tipo VARCHAR(20),
    valor_descuento DECIMAL(10, 2),
    ambito_aplicacion VARCHAR(20),
    cantidad_minima INTEGER,
    prioridad INTEGER,
    stackeable BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nombre,
        p.tipo,
        p.valor_descuento,
        p.ambito_aplicacion,
        p.cantidad_minima,
        p.prioridad,
        p.stackeable
    FROM promociones p
    WHERE p.activo = true
      AND (p.fecha_fin IS NULL OR p.fecha_fin > CURRENT_TIMESTAMP)
      AND (p.uso_maximo IS NULL OR p.uso_actual < p.uso_maximo)
      AND (
          -- Direct product match
          (p.ambito_aplicacion = 'producto' AND p.entidad_id = p_producto_id)
          OR
          -- Product's category match
          (p.ambito_aplicacion = 'categoria' AND p.entidad_id IN (
              SELECT lista_precio_id FROM lista_articulo WHERE producto_id = p_producto_id
          ))
          OR
          -- Product's marca match
          (p.ambito_aplicacion = 'marca' AND p.entidad_id IN (
              SELECT id FROM productos WHERE id = p_producto_id AND marca IS NOT NULL
          ))
          OR
          -- Product's fabricante match
          (p.ambito_aplicacion = 'fabricante' AND p.entidad_id IN (
              SELECT id FROM productos WHERE id = p_producto_id AND fabricante IS NOT NULL
          ))
          OR
          -- Cart-wide promotion
          (p.ambito_aplicacion = 'carrito')
      )
    ORDER BY p.prioridad DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. FUNCTION TO CALCULATE DISCOUNT
-- ============================================
CREATE OR REPLACE FUNCTION fn_calcular_descuento_promocion(
    p_promocion_id INTEGER,
    p_precio_original DECIMAL(12, 2),
    p_cantidad INTEGER DEFAULT 1
) RETURNS DECIMAL(12, 2) AS $$
DECLARE
    v_tipo VARCHAR(20);
    v_valor DECIMAL(10, 2);
    v_resultado DECIMAL(12, 2);
BEGIN
    SELECT tipo, valor_descuento INTO v_tipo, v_valor
    FROM promociones WHERE id = p_promocion_id;
    
    CASE v_tipo
        WHEN 'porcentaje' THEN
            v_resultado := p_precio_original * (v_valor / 100);
        WHEN 'b2g' THEN
            -- Buy 2, get discount on 2nd item
            IF p_cantidad >= 2 THEN
                v_resultado := (p_precio_original * (v_valor / 100));
            ELSE
                v_resultado := 0;
            END IF;
        WHEN 'precio_fijo' THEN
            v_resultado := p_precio_original - v_valor;
            IF v_resultado < 0 THEN v_resultado := 0; END IF;
        WHEN 'cantidad' THEN
            -- Fixed price for quantity (e.g., 3 for $10)
            v_resultado := p_precio_original - v_valor;
        ELSE
            v_resultado := 0;
    END CASE;
    
    RETURN round(v_resultado, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. TRIGGER TO UPDATE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION fn_update_promociones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promociones_updated ON promociones;
CREATE TRIGGER trg_promociones_updated
    BEFORE UPDATE ON promociones
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_promociones_timestamp();

COMMIT;
