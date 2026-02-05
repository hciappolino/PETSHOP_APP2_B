import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Sales summary by day
router.get('/ventas-diarias', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { dias } = req.query;
        const days = parseInt(dias) || 7;
        const result = await pool.query(
            `SELECT DATE(fecha) as fecha, COUNT(*) as cantidad_ventas, SUM(total) as total_ventas
             FROM ventas WHERE fecha >= CURRENT_DATE - ($1 || ' days')::INTERVAL
             GROUP BY DATE(fecha)
             ORDER BY DATE(fecha) DESC`,
            [ days]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Daily sales report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de ventas diarias' });
    }
});

// Sales details today
router.get('/ventas-del-dia', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                v.id as venta_id,
                v.fecha,
                v.tipo_venta,
                c.nombre as cliente_nombre,
                p.nombre as producto_nombre,
                p.fabricante as producto_fabricante,
                p.marca as producto_marca,
                vi.cantidad,
                vi.precio_venta as precio_unitario,
                CASE 
                    WHEN COALESCE(v.descuento_total, 0) > 0 THEN
                        (vi.cantidad * vi.precio_venta)
                        - (
                            (vi.cantidad * vi.precio_venta)
                            / NULLIF(SUM(vi.cantidad * vi.precio_venta) OVER (PARTITION BY v.id), 0)
                        ) * v.descuento_total
                    ELSE (vi.cantidad * vi.precio_venta)
                END as subtotal
             FROM ventas v
             LEFT JOIN clientes c ON v.cliente_id = c.id
             LEFT JOIN venta_items vi ON v.id = vi.venta_id
             LEFT JOIN productos p ON vi.producto_id = p.id
             WHERE DATE(v.fecha) = CURRENT_DATE
             ORDER BY v.fecha DESC, vi.id DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Today sales report error:', error);
        res.status(500).json({ error: 'Error al obtener ventas del día' });
    }
});

// Best selling products
router.get('/productos-mas-vendidos', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { limite } = req.query;
        const limit = parseInt(limite) || 10;
        const result = await pool.query(
            `SELECT p.nombre, p.codigo, SUM(vi.cantidad) as total_vendido, COUNT(vi.id) as veces_vendido
             FROM venta_items vi
             JOIN productos p ON vi.producto_id = p.id
             GROUP BY p.id, p.nombre, p.codigo
             ORDER BY total_vendido DESC
             LIMIT $1`,
            [ limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Best sellers report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de productos más vendidos' });
    }
});

// Low stock report
router.get('/stock-bajo', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT nombre, codigo, stock_actual, stock_minimo
             FROM productos WHERE stock_actual <= stock_minimo AND activo = true
             ORDER BY stock_actual ASC`,
            []
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Low stock report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de stock bajo' });
    }
});

// Profit report
router.get('/ganancias-estimadas', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta } = req.query;
        const result = await pool.query(
            `SELECT DATE(v.fecha) as fecha, 
                    SUM(v.total) as venta_total,
                    SUM(COALESCE((SELECT SUM(vi.cantidad * p.costo_ultima_compra) 
                                 FROM venta_items vi 
                                 JOIN productos p ON vi.producto_id = p.id 
                                 WHERE vi.venta_id = v.id), 0)) as costo_total_estimado
             FROM ventas v
             WHERE v.fecha >= COALESCE($1, '1970-01-01')::DATE 
               AND v.fecha <= COALESCE($2, '2100-01-01')::DATE
             GROUP BY DATE(v.fecha)
             ORDER BY DATE(v.fecha) DESC`,
            [ fecha_desde, fecha_hasta]
        );

        const formattedResult = result.rows.map(row => ({
            ...row,
            ganancia_estimada: parseFloat(row.venta_total) - parseFloat(row.costo_total_estimado)
        }));

        res.json(formattedResult);
    } catch (error) {
        console.error('Profit report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de ganancias' });
    }
});

// Monthly expenses report (services/insumos without stock)
router.get('/gastos-del-mes', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                DATE(cf.fecha) as fecha,
                SUM(cr.subtotal) as total_gastos
             FROM compras_renglones cr
             JOIN compras_facturas cf ON cr.factura_id = cf.id
             WHERE cr.producto_id IS NULL
               AND DATE_TRUNC('month', cf.fecha) = DATE_TRUNC('month', CURRENT_DATE)
             GROUP BY DATE(cf.fecha)
             ORDER BY DATE(cf.fecha) DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Monthly expenses report error:', error);
        res.status(500).json({ error: 'Error al obtener gastos del mes' });
    }
});

// Get financial movements report
router.get('/movimientos-fondos', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { limite } = req.query;
        const limit = parseInt(limite) || 50;
        const result = await pool.query(
            `SELECT fm.*, cp.nombre as cuenta_nombre, u.nombre as usuario_nombre
             FROM fondos_movimientos fm
             JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
             LEFT JOIN usuarios u ON fm.usuario_id = u.id
             ORDER BY fm.created_at DESC
             LIMIT $1`,
            [ limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Funds movements report error:', error);
        res.status(500).json({ error: 'Error al obtener movimientos de fondos' });
    }
});

// Get stock movement report
router.get('/movimientos-stock', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { limite } = req.query;
        const limit = parseInt(limite) || 50;
        const result = await pool.query(
            `SELECT sm.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
             FROM stock_movimientos sm
             JOIN productos p ON sm.producto_id = p.id
             LEFT JOIN usuarios u ON sm.usuario_id = u.id
             ORDER BY sm.created_at DESC
             LIMIT $1`,
            [ limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Stock movements report error:', error);
        res.status(500).json({ error: 'Error al obtener movimientos de stock' });
    }
});

// Financial summary dashboard
router.get('/resumen-financiero', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta } = req.query;
        // 1. Total Sales
        const salesResult = await pool.query(
            `SELECT SUM(total) as total
             FROM ventas
             WHERE fecha >= COALESCE($1::TIMESTAMP, '1970-01-01') 
               AND fecha <= COALESCE($2::TIMESTAMP, '2100-01-01')`,
            [ fecha_desde, fecha_hasta]
        );

        // 2. Total Merchandise Purchases (lines with product_id)
        const merchandiseResult = await pool.query(
            `SELECT SUM(cr.subtotal) as total
             FROM compras_renglones cr
             JOIN compras_facturas cf ON cr.factura_id = cf.id
             WHERE cr.producto_id IS NOT NULL
               AND cf.fecha >= COALESCE($1::DATE, '1970-01-01') 
               AND cf.fecha <= COALESCE($2::DATE, '2100-01-01')`,
            [ fecha_desde, fecha_hasta]
        );

        // 3. Total Expenses (lines without product_id)
        const expensesResult = await pool.query(
            `SELECT SUM(cr.subtotal) as total
             FROM compras_renglones cr
             JOIN compras_facturas cf ON cr.factura_id = cf.id
             WHERE cr.producto_id IS NULL
               AND cf.fecha >= COALESCE($1::DATE, '1970-01-01') 
               AND cf.fecha <= COALESCE($2::DATE, '2100-01-01')`,
            [ fecha_desde, fecha_hasta]
        );

        // Calculate stock valuation at sale price using default price list
        let valorStockVenta = 0;
        try {
            const defaultListRes = await pool.query(`SELECT id FROM listas_precios WHERE es_default = true LIMIT 1`);
            if (defaultListRes.rows.length > 0) {
                const listaId = defaultListRes.rows[0].id;
                const valorRes = await pool.query(
                    `SELECT COALESCE(SUM(p.stock_actual * COALESCE(la.precio_venta_unidad, 0)), 0) as valor
                     FROM productos p
                     LEFT JOIN lista_articulo la ON p.id = la.producto_id AND la.lista_precio_id = $1
                     WHERE p.stock_actual > 0`,
                    [ listaId ]
                );
                valorStockVenta = parseFloat(valorRes.rows[0].valor || 0);
            }
        } catch (e) {
            console.warn('Error computing valor stock venta:', e.message || e);
        }

        res.json({
            ventas: parseFloat(salesResult.rows[0].total || 0),
            mercaderia: parseFloat(merchandiseResult.rows[0].total || 0),
            insumos: parseFloat(expensesResult.rows[0].total || 0),
            ganancia: parseFloat((salesResult.rows[0].total || 0) - (merchandiseResult.rows[0].total || 0) - (expensesResult.rows[0].total || 0)),
            valor_stock_venta: valorStockVenta,
            periodo: { desde: fecha_desde, hasta: fecha_hasta }
        });
        
    } catch (error) {
        console.error('Financial summary error:', error);
        res.status(500).json({ error: 'Error al obtener resumen financiero' });
    }
});

// Get last purchase line for a product
router.get('/ultima-compra/:producto_id', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { producto_id } = req.params;
        const result = await pool.query(
            `SELECT cr.precio_costo, cf.fecha as fecha_factura, cf.id as factura_id
             FROM compras_renglones cr
             JOIN compras_facturas cf ON cr.factura_id = cf.id
             WHERE cr.producto_id = $1
             ORDER BY cf.fecha DESC, cf.id DESC
             LIMIT 1`,
            [ producto_id ]
        );

        if (result.rows.length === 0) {
            return res.json({ precio_costo: null });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get last purchase for product error:', error);
        res.status(500).json({ error: 'Error al obtener última compra' });
    }
});

// 🔥 CORREGIDO: Reporte de Rendimiento por Bolsa (Granel)
router.get('/rendimiento-granel', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const query = `
            WITH aperturas AS (
                -- Obtener todas las aperturas de bolsas con su ventana de tiempo
                SELECT 
                    sm.id as apertura_id,
                    sm.producto_id,
                    p.nombre as producto_nombre,
                    p.factor_conversion as kilos_teoricos,
                    sm.created_at as fecha_inicio,
                    LEAD(sm.created_at) OVER (PARTITION BY sm.producto_id ORDER BY sm.created_at) as fecha_fin,
                    u.nombre as usuario_nombre
                FROM stock_movimientos sm
                JOIN productos p ON sm.producto_id = p.id
                JOIN usuarios u ON sm.usuario_id = u.id
                WHERE sm.motivo = 'APERTURA_BOLSA'
            ),
            ventas_con_bolsa AS (
                -- 🔥 CORRECCIÓN: Asociar cada venta a la bolsa MÁS RECIENTE que estaba abierta
                SELECT DISTINCT ON (vi.id)
                    vi.id as venta_item_id,
                    vi.venta_id,
                    vi.producto_id,
                    vi.cantidad,
                    v.fecha as fecha_venta,
                    a.apertura_id
                FROM venta_items vi
                JOIN ventas v ON vi.venta_id = v.id
                JOIN aperturas a ON vi.producto_id = a.producto_id
                WHERE vi.es_granel = true
                    AND v.fecha >= a.fecha_inicio
                    AND (v.fecha < a.fecha_fin OR a.fecha_fin IS NULL)
                ORDER BY vi.id, a.fecha_inicio DESC  -- 🔥 CLAVE: Tomar la bolsa MÁS RECIENTE
            )
            SELECT 
                a.apertura_id,
                a.producto_id,
                a.producto_nombre,
                a.kilos_teoricos,
                a.fecha_inicio,
                a.fecha_fin,
                a.usuario_nombre,
                COALESCE(SUM(vcb.cantidad), 0) as kilos_vendidos_reales,
                (a.kilos_teoricos - COALESCE(SUM(vcb.cantidad), 0)) as diferencia_kilos,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'fecha', vcb.fecha_venta,
                            'cantidad', vcb.cantidad,
                            'venta_id', vcb.venta_id
                        ) ORDER BY vcb.fecha_venta ASC
                    ) FILTER (WHERE vcb.venta_item_id IS NOT NULL), 
                    '[]'
                ) as detalle_ventas
            FROM aperturas a
            LEFT JOIN ventas_con_bolsa vcb ON a.apertura_id = vcb.apertura_id
            GROUP BY 
                a.apertura_id, 
                a.producto_id, 
                a.producto_nombre, 
                a.kilos_teoricos, 
                a.fecha_inicio, 
                a.fecha_fin, 
                a.usuario_nombre
            ORDER BY a.fecha_inicio DESC;
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en reporte de granel:', error);
        res.status(500).json({ error: 'Error en reporte de granel' });
    }
});

export default router;
