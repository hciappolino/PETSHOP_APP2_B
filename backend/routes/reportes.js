import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizePermission } from '../middleware/auth.js';

const router = express.Router();

// Constantes de motivos
const STOCK_APERTURA_BOLSA = 4;
const FONDO_DEPOSITO = 4;
const FONDO_APERTURA_CAJA = 7;
const FONDO_CIERRE_CAJA = 8;

// Sales summary by day
router.get('/ventas-diarias', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
    try {
        const { dias } = req.query;
        const days = parseInt(dias) || 7;
        const result = await pool.query(
            `WITH dias AS (
                SELECT generate_series(
                    CURRENT_DATE - ($1::int - 1),
                    CURRENT_DATE,
                    INTERVAL '1 day'
                )::date AS fecha
            ),
            ventas_por_dia AS (
                SELECT
                    DATE(v.fecha) AS fecha,
                    COUNT(*) AS cantidad_ventas,
                    COALESCE(SUM(v.total), 0) AS total_ventas,
                    COALESCE(SUM(CASE WHEN v.tipo_venta = 'CONTADO' THEN v.total ELSE 0 END), 0) AS total_contado,
                    COALESCE(SUM(CASE WHEN v.tipo_venta = 'CUENTA_CORRIENTE' THEN v.total ELSE 0 END), 0) AS total_cuenta_corriente
                FROM ventas v
                WHERE DATE(v.fecha) BETWEEN CURRENT_DATE - ($1::int - 1) AND CURRENT_DATE
                GROUP BY DATE(v.fecha)
            ),
            articulos_por_dia AS (
                SELECT
                    DATE(v.fecha) AS fecha,
                    COALESCE(SUM(vi.cantidad), 0) AS cantidad_articulos
                FROM ventas v
                JOIN venta_items vi ON vi.venta_id = v.id
                WHERE DATE(v.fecha) BETWEEN CURRENT_DATE - ($1::int - 1) AND CURRENT_DATE
                GROUP BY DATE(v.fecha)
            )
            SELECT
                d.fecha,
                COALESCE(vd.cantidad_ventas, 0) AS cantidad_ventas,
                COALESCE(vd.total_ventas, 0) AS total_ventas,
                COALESCE(ad.cantidad_articulos, 0) AS cantidad_articulos,
                CASE
                    WHEN COALESCE(vd.cantidad_ventas, 0) > 0
                    THEN COALESCE(vd.total_ventas, 0) / vd.cantidad_ventas
                    ELSE 0
                END AS ticket_promedio,
                COALESCE(vd.total_contado, 0) AS total_contado,
                COALESCE(vd.total_cuenta_corriente, 0) AS total_cuenta_corriente
            FROM dias d
            LEFT JOIN ventas_por_dia vd ON vd.fecha = d.fecha
            LEFT JOIN articulos_por_dia ad ON ad.fecha = d.fecha
            ORDER BY d.fecha DESC`,
            [days]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Daily sales report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de ventas diarias' });
    }
});

// Sales summary by month
router.get('/ventas-por-mes', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
    try {
        const { meses } = req.query;
        const months = parseInt(meses, 10) || 12;

        const result = await pool.query(
            `WITH meses AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE) - (($1::int - 1) * INTERVAL '1 month'),
                    DATE_TRUNC('month', CURRENT_DATE),
                    INTERVAL '1 month'
                )::date AS mes_inicio
            ),
            ventas_mensuales AS (
                SELECT
                    DATE_TRUNC('month', v.fecha)::date AS mes_inicio,
                    COUNT(*) AS cantidad_ventas_mes,
                    COALESCE(SUM(v.total), 0) AS total_ventas
                FROM ventas v
                WHERE v.fecha >= DATE_TRUNC('month', CURRENT_DATE) - (($1::int - 1) * INTERVAL '1 month')
                GROUP BY DATE_TRUNC('month', v.fecha)
            )
            SELECT
                m.mes_inicio,
                EXTRACT(YEAR FROM m.mes_inicio)::int AS anio,
                EXTRACT(MONTH FROM m.mes_inicio)::int AS mes_numero,
                COALESCE(vm.total_ventas, 0) AS total_ventas,
                CASE
                    WHEN m.mes_inicio = DATE_TRUNC('month', CURRENT_DATE)::date
                    THEN ROUND(COALESCE(vm.cantidad_ventas_mes, 0)::numeric / NULLIF(EXTRACT(DAY FROM CURRENT_DATE)::numeric, 0), 2)
                    ELSE ROUND(
                        COALESCE(vm.cantidad_ventas_mes, 0)::numeric
                        / EXTRACT(
                            DAY FROM (
                                DATE_TRUNC('month', m.mes_inicio) + INTERVAL '1 month - 1 day'
                            )
                        )::numeric,
                        2
                    )
                END AS promedio_cantidad_ventas_dia,
                CASE
                    WHEN COALESCE(vm.cantidad_ventas_mes, 0) > 0
                    THEN ROUND(COALESCE(vm.total_ventas, 0)::numeric / vm.cantidad_ventas_mes::numeric, 2)
                    ELSE 0
                END AS ticket_promedio
            FROM meses m
            LEFT JOIN ventas_mensuales vm ON vm.mes_inicio = m.mes_inicio
            ORDER BY m.mes_inicio DESC`,
            [months]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Monthly sales report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de ventas por mes' });
    }
});

// Sales details today
router.get('/ventas-del-dia', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
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
router.get('/productos-mas-vendidos', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
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

// Stock bajo mínimo - Enhanced with supplier info and filtering
router.get('/stock-bajo-minimo', authenticateToken, authorizePermission('reportes.stock'), async (req, res) => {
    try {
        const { tipo_animal, ordenar } = req.query;
        
        let query = `
            SELECT 
                p.id,
                p.codigo,
                p.nombre as producto_nombre,
                p.stock_actual,
                p.stock_minimo,
                p.tipo_animal,
                p.marca,
                p.fabricante,
                COALESCE(pr.nombre, 'Sin proveedor') as proveedor_nombre,
                pr.telefono as proveedor_telefono,
                pr.email as proveedor_email,
                (p.stock_minimo - p.stock_actual) as diferencia,
                CASE 
                    WHEN p.stock_actual = 0 THEN 'CRITICO'
                    WHEN p.stock_actual <= (p.stock_minimo * 0.25) THEN 'ALTO'
                    WHEN p.stock_actual <= (p.stock_minimo * 0.5) THEN 'MEDIO'
                    ELSE 'BAJO'
                END as urgencia
            FROM productos p
            LEFT JOIN articulos_proveedor ap ON ap.producto_id = p.id
            LEFT JOIN proveedores pr ON pr.id = ap.proveedor_id
            WHERE p.stock_actual <= p.stock_minimo AND p.activo = true
        `;
        
        const params = [];
        
        // Filter by animal type
        if (tipo_animal && tipo_animal !== 'todos') {
            query += ` AND p.tipo_animal = $${params.length + 1}`;
            params.push(tipo_animal);
        }
        
        // Sort order
        if (ordenar === 'urgencia') {
            query += ` ORDER BY 
                CASE 
                    WHEN p.stock_actual = 0 THEN 1 
                    WHEN p.stock_actual <= (p.stock_minimo * 0.25) THEN 2 
                    WHEN p.stock_actual <= (p.stock_minimo * 0.5) THEN 3 
                    ELSE 4 
                END ASC,
                diferencia DESC,
                p.nombre ASC`;
        } else if (ordenar === 'producto') {
            query += ` ORDER BY p.nombre ASC`;
        } else {
            // Default: sort by how far below minimum (most urgent first)
            query += ` ORDER BY diferencia DESC, p.nombre ASC`;
        }
        
        const result = await pool.query(query, params);
        
        const formattedResult = result.rows.map(row => ({
            ...row,
            stock_actual: parseInt(row.stock_actual),
            stock_minimo: parseInt(row.stock_minimo),
            diferencia: parseInt(row.diferencia),
            suggested_reorder: parseInt(row.stock_minimo * 2 - row.stock_actual) // Suggested reorder to double minimum
        }));
        
        res.json(formattedResult);
    } catch (error) {
        console.error('Stock bajo mínimo report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de stock bajo mínimo' });
    }
});

// Profit report
router.get('/ganancias-estimadas', authenticateToken, authorizePermission('reportes.ganancias'), async (req, res) => {
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
router.get('/gastos-del-mes', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
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
router.get('/movimientos-fondos', authenticateToken, authorizePermission('fondos.ver'), async (req, res) => {
    try {
        const { limite } = req.query;
        const limit = parseInt(limite) || 50;
        const result = await pool.query(
            `SELECT fm.*, cp.nombre as cuenta_nombre, u.nombre as usuario_nombre, fm2.nombre as motivo_nombre
             FROM fondos_movimientos fm
             JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
             LEFT JOIN usuarios u ON fm.usuario_id = u.id
             LEFT JOIN fondos_motivos fm2 ON fm.motivo_id = fm2.id
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
router.get('/movimientos-stock', authenticateToken, authorizePermission('stock.ver'), async (req, res) => {
    try {
        const { limite } = req.query;
        const limit = parseInt(limite) || 50;
        const result = await pool.query(
            `SELECT sm.*, p.nombre as producto_nombre, u.nombre as usuario_nombre, sm2.nombre as motivo_nombre, sm2.nombre as motivo
             FROM stock_movimientos sm
             JOIN productos p ON sm.producto_id = p.id
             LEFT JOIN usuarios u ON sm.usuario_id = u.id
             LEFT JOIN stock_motivos sm2 ON sm.motivo_id = sm2.id
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
router.get('/resumen-financiero', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
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
router.get('/ultima-compra/:producto_id', authenticateToken, authorizePermission('compras.ver'), async (req, res) => {
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

// 🔥 NUEVO: Reporte de Ventas Completo
router.get('/ventas', authenticateToken, authorizePermission('reportes.ventas'), async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, periodo } = req.query;
        
        // Calculate date range based on period
        let desde, hasta;
        const now = new Date();
        
        if (periodo) {
            switch (periodo) {
                case 'dia':
                    desde = new Date(now.setHours(0, 0, 0, 0));
                    hasta = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'semana':
                    const dayOfWeek = now.getDay();
                    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    desde = new Date(now.setDate(diff));
                    desde.setHours(0, 0, 0, 0);
                    hasta = new Date();
                    hasta.setHours(23, 59, 59, 999);
                    break;
                case 'mes':
                    desde = new Date(now.getFullYear(), now.getMonth(), 1);
                    desde.setHours(0, 0, 0, 0);
                    hasta = new Date();
                    hasta.setHours(23, 59, 59, 999);
                    break;
                default:
                    desde = fecha_desde ? new Date(fecha_desde) : new Date(now.setDate(now.getDate() - 30));
                    hasta = fecha_hasta ? new Date(fecha_hasta) : new Date();
            }
        } else if (fecha_desde && fecha_hasta) {
            desde = new Date(fecha_desde);
            hasta = new Date(fecha_hasta);
            hasta.setHours(23, 59, 59, 999);
        } else {
            // Default: last 30 days
            desde = new Date(now.setDate(now.getDate() - 30));
            hasta = new Date();
            hasta.setHours(23, 59, 59, 999);
        }
        
        // 1. Total sales amount and transaction count
        const summaryResult = await pool.query(
            `SELECT 
                COUNT(*) as numero_ventas,
                COALESCE(SUM(total), 0) as total_ventas,
                COALESCE(AVG(total), 0) as ticket_promedio
             FROM ventas
             WHERE fecha >= $1 AND fecha <= $2
               AND cancelada = false`,
            [desde, hasta]
        );
        
        // 2. Sales by type (CONTADO vs CUENTA_CORRIENTE)
        const salesByTypeResult = await pool.query(
            `SELECT 
                tipo_venta,
                COUNT(*) as numero_ventas,
                COALESCE(SUM(total), 0) as total_ventas
             FROM ventas
             WHERE fecha >= $1 AND fecha <= $2
               AND cancelada = false
             GROUP BY tipo_venta
             ORDER BY tipo_venta`,
            [desde, hasta]
        );
        
        // 3. Sales by day for the period
        const salesByDayResult = await pool.query(
            `SELECT 
                DATE(fecha) as fecha,
                COUNT(*) as numero_ventas,
                COALESCE(SUM(total), 0) as total_ventas
             FROM ventas
             WHERE fecha >= $1 AND fecha <= $2
               AND cancelada = false
             GROUP BY DATE(fecha)
             ORDER BY DATE(fecha) DESC`,
            [desde, hasta]
        );
        
        // 4. Top selling products
        const topProductsResult = await pool.query(
            `SELECT 
                p.id as producto_id,
                p.nombre as producto_nombre,
                p.codigo as producto_codigo,
                SUM(vi.cantidad) as cantidad_vendida,
                COUNT(DISTINCT vi.venta_id) as numero_ventas,
                COALESCE(SUM(vi.cantidad * vi.precio_venta), 0) as total_ventas
             FROM venta_items vi
             JOIN ventas v ON vi.venta_id = v.id
             JOIN productos p ON vi.producto_id = p.id
             WHERE v.fecha >= $1 AND v.fecha <= $2
               AND v.cancelada = false
             GROUP BY p.id, p.nombre, p.codigo
             ORDER BY total_ventas DESC
             LIMIT 20`,
            [desde, hasta]
        );
        
        // 5. Detailed sales (last 100)
        const detailedSalesResult = await pool.query(
            `SELECT 
                v.id as venta_id,
                v.fecha,
                v.tipo_venta,
                c.nombre as cliente_nombre,
                u.nombre as usuario_nombre,
                v.total,
                v.notas
             FROM ventas v
             LEFT JOIN clientes c ON v.cliente_id = c.id
             LEFT JOIN usuarios u ON v.usuario_id = u.id
             WHERE v.fecha >= $1 AND v.fecha <= $2
               AND v.cancelada = false
             ORDER BY v.fecha DESC
             LIMIT 100`,
            [desde, hasta]
        );
        
        // Format the response
        const summary = summaryResult.rows[0];
        const salesByType = salesByTypeResult.rows.reduce((acc, row) => {
            acc[row.tipo_venta] = {
                numero_ventas: parseInt(row.numero_ventas),
                total_ventas: parseFloat(row.total_ventas)
            };
            return acc;
        }, {});
        
        res.json({
            periodo: {
                desde: desde.toISOString(),
                hasta: hasta.toISOString(),
                periodo: periodo || 'personalizado'
            },
            resumen: {
                total_ventas: parseFloat(summary.total_ventas || 0),
                numero_ventas: parseInt(summary.numero_ventas || 0),
                ticket_promedio: parseFloat(summary.ticket_promedio || 0)
            },
            ventas_por_tipo: salesByType,
            ventas_por_dia: salesByDayResult.rows.map(row => ({
                ...row,
                numero_ventas: parseInt(row.numero_ventas),
                total_ventas: parseFloat(row.total_ventas)
            })),
            productos_top: topProductsResult.rows.map(row => ({
                ...row,
                cantidad_vendida: parseInt(row.cantidad_vendida),
                numero_ventas: parseInt(row.numero_ventas),
                total_ventas: parseFloat(row.total_ventas)
            })),
            ventas_detalles: detailedSalesResult.rows
        });
        
    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de ventas' });
    }
});

// © CORREGIDO: Reporte de Rendimiento por Bolsa (Granel)
router.get('/rendimiento-granel', authenticateToken, authorizePermission('stock.granel'), async (req, res) => {
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
                WHERE sm.motivo_id = $1
            ),
            ventas_con_bolsa AS (
                -- © CORRECCIÓN: Asociar cada venta a la bolsa MÁS RECIENTE que estaba abierta
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
                ORDER BY vi.id, a.fecha_inicio DESC  -- © CLAVE: Tomar la bolsa MÁS RECIENTE
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
        
        const result = await pool.query(query, [STOCK_APERTURA_BOLSA]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en reporte de granel:', error);
        res.status(500).json({ error: 'Error en reporte de granel' });
    }
});

// Alertas de granel para POS (bolsas abiertas con pocos kilos disponibles)
router.get('/alertas-granel', authenticateToken, authorizePermission('pos.ver'), async (req, res) => {
    try {
        const query = `
            WITH aperturas AS (
                SELECT 
                    sm.id as apertura_id,
                    sm.producto_id,
                    p.nombre as producto_nombre,
                    p.factor_conversion as kilos_teoricos,
                    sm.created_at as fecha_inicio,
                    LEAD(sm.created_at) OVER (PARTITION BY sm.producto_id ORDER BY sm.created_at) as fecha_fin
                FROM stock_movimientos sm
                JOIN productos p ON sm.producto_id = p.id
                WHERE sm.motivo_id = $1
            ),
            ventas_con_bolsa AS (
                SELECT DISTINCT ON (vi.id)
                    vi.id as venta_item_id,
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
                ORDER BY vi.id, a.fecha_inicio DESC
            )
            SELECT 
                a.apertura_id,
                a.producto_id,
                a.producto_nombre,
                a.kilos_teoricos,
                COALESCE(SUM(vcb.cantidad), 0) as kilos_vendidos_reales,
                (a.kilos_teoricos - COALESCE(SUM(vcb.cantidad), 0)) as kilos_disponibles
            FROM aperturas a
            LEFT JOIN ventas_con_bolsa vcb ON a.apertura_id = vcb.apertura_id
            WHERE a.fecha_fin IS NULL
            GROUP BY 
                a.apertura_id, 
                a.producto_id, 
                a.producto_nombre, 
                a.kilos_teoricos
            HAVING (a.kilos_teoricos - COALESCE(SUM(vcb.cantidad), 0)) < 2
            ORDER BY kilos_disponibles ASC, a.producto_nombre ASC;
        `;

        const result = await pool.query(query, [STOCK_APERTURA_BOLSA]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en alertas de granel:', error);
        res.status(500).json({ error: 'Error en alertas de granel' });
    }
});

// Reporte de Estado de Cuenta Corriente por Cliente
router.get('/cliente-cc/:cliente_id', authenticateToken, authorizePermission('clientes.cc'), async (req, res) => {
    try {
        const { cliente_id } = req.params;
        const { fecha_desde, fecha_hasta } = req.query;
        
        // Parse dates as local dates (YYYY-MM-DD format from frontend)
        // Handle timezone by parsing the date string directly
        const parseDate = (str) => {
            if (!str) return null;
            const [year, month, day] = str.split('-').map(Number);
            // Create date in local time (midnight)
            return new Date(year, month - 1, day, 0, 0, 0, 0);
        };
        
        const desde = fecha_desde ? parseDate(fecha_desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const hasta = fecha_hasta ? parseDate(fecha_hasta) : new Date();
        // Set hasta to end of day
        hasta.setHours(23, 59, 59, 999);
        
        // Format dates for PostgreSQL (ISO format with timezone)
        const desdeStr = desde.toISOString();
        const hastaStr = hasta.toISOString();
        
        // 1. Get client info
        const clienteResult = await pool.query(
            `SELECT id, nombre, dni_cuit, telefono, email, saldo_cc
             FROM clientes WHERE id = $1`,
            [cliente_id]
        );
        
        if (clienteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        
        const cliente = clienteResult.rows[0];
        
        // 2. Get sales on account (CUENTA_CORRIENTE)
        const ventasResult = await pool.query(
            `SELECT 
                v.id as venta_id,
                v.fecha,
                v.total,
                v.notas,
                'VENTA' as tipo_movimiento
             FROM ventas v
             WHERE v.cliente_id = $1
               AND v.tipo_venta = 'CUENTA_CORRIENTE'
               AND v.cancelada = false
               AND v.fecha >= $2::date AND v.fecha <= $3::date
             ORDER BY v.fecha ASC`,
            [cliente_id, fecha_desde, fecha_hasta]
        );
        
        // 3. Get payments made to this client (from fondos_movimientos)
        const pagosResult = await pool.query(
            `SELECT 
                fm.id,
                fm.created_at as fecha,
                fm.monto,
                fm.descripcion,
                'PAGO' as tipo_movimiento
             FROM fondos_movimientos fm
             WHERE fm.referencia_id = $1
               AND fm.motivo_id = $4
               AND fm.created_at >= $2::date AND fm.created_at <= $3::date
             ORDER BY fm.created_at ASC`,
            [cliente_id, fecha_desde, fecha_hasta, FONDO_DEPOSITO]
        );
        
        // 4. Get opening balance (balance before fecha_desde)
        // For opening balance, we need to consider all records BEFORE the start date
        const openingBalanceResult = await pool.query(
            `SELECT 
                COALESCE(
                    (SELECT SUM(v.total) 
                     FROM ventas v 
                     WHERE v.cliente_id = $1
                       AND v.tipo_venta = 'CUENTA_CORRIENTE'
                       AND v.cancelada = false
                       AND v.fecha < $2::date) -
                    (SELECT COALESCE(SUM(fm.monto), 0) 
                     FROM fondos_movimientos fm 
                     WHERE fm.referencia_id = $1
                       AND fm.motivo_id = $3
                       AND fm.created_at < $2::date)
                , 0) as saldo_inicial`,
            [cliente_id, fecha_desde, FONDO_DEPOSITO]
        );
        
        const saldoInicial = parseFloat(openingBalanceResult.rows[0].saldo_inicial || 0);
        
        // 5. Merge and sort all movements chronologically
        const ventas = ventasResult.rows.map(v => ({
            id: v.venta_id,
            fecha: v.fecha,
            descripcion: v.notas || `Venta a cuenta #${v.venta_id}`,
            tipo_movimiento: 'VENTA',
            debito: parseFloat(v.total),
            credito: 0,
            saldo: 0 // Will be calculated
        }));
        
        const pagos = pagosResult.rows.map(p => ({
            id: p.id,
            fecha: p.fecha,
            descripcion: p.descripcion || 'Pago',
            tipo_movimiento: 'PAGO',
            debito: 0,
            credito: parseFloat(p.monto),
            saldo: 0 // Will be calculated
        }));
        
        // Merge and sort by date
        const movimientos = [...ventas, ...pagos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        
        // Calculate running balance
        let runningBalance = saldoInicial;
        const movimientosConSaldo = movimientos.map(m => {
            runningBalance = runningBalance + m.debito - m.credito;
            return { ...m, saldo: runningBalance };
        });
        
        // Calculate totals
        const totalDebitos = movimientos.reduce((sum, m) => sum + m.debito, 0);
        const totalCreditos = movimientos.reduce((sum, m) => sum + m.credito, 0);
        const saldoFinal = saldoInicial + totalDebitos - totalCreditos;
        
        res.json({
            cliente: {
                id: cliente.id,
                nombre: cliente.nombre,
                dni_cuit: cliente.dni_cuit,
                telefono: cliente.telefono,
                email: cliente.email,
                saldo_cc: parseFloat(cliente.saldo_cc || 0)
            },
            periodo: {
                desde: fecha_desde || desde.toISOString().split('T')[0],
                hasta: fecha_hasta || hasta.toISOString().split('T')[0]
            },
            resumen: {
                saldo_inicial: saldoInicial,
                total_debitos: totalDebitos,
                total_creditos: totalCreditos,
                saldo_final: saldoFinal
            },
            movimientos: movimientosConSaldo
        });
        
    } catch (error) {
        console.error('Estado de cuenta CC error:', error);
        res.status(500).json({ error: 'Error al obtener estado de cuenta' });
    }
});

// © NUEVO: Reporte de Caja Diario
router.get('/caja/diaria', authenticateToken, authorizePermission('caja.reportes'), async (req, res) => {
    try {
        const { fecha } = req.query;
        
        // Default to today if no date provided
        const targetDate = fecha ? new Date(fecha) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // 1. Find session for the target date
        const sessionResult = await pool.query(
            `SELECT 
                sc.*,
                u_apertura.nombre as usuario_apertura_nombre,
                u_cierre.nombre as usuario_cierre_nombre
             FROM sesiones_caja sc
             LEFT JOIN usuarios u_apertura ON sc.usuario_apertura_id = u_apertura.id
             LEFT JOIN usuarios u_cierre ON sc.usuario_cierre_id = u_cierre.id
             WHERE DATE(sc.apertura_fecha) = $1
             ORDER BY sc.apertura_fecha DESC
             LIMIT 1`,
            [targetDateStr]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.json({
                fecha: targetDateStr,
                sesion: null,
                resumen: {
                    saldo_apertura: 0,
                    total_ingresos: 0,
                    total_egresos: 0,
                    saldo_cierre_esperado: 0,
                    saldo_cierre_real: null,
                    diferencia: null
                },
                movimientos: [],
                advertencia: 'No se encontró sesión de caja para esta fecha'
            });
        }
        
        const sesion = sessionResult.rows[0];
        const sesionId = sesion.id;
        
        // 2. Get all fund movements for this session (only operative cash)
        const movimientosResult = await pool.query(
            `SELECT 
                fm.*,
                cp.nombre as cuenta_nombre,
                u.nombre as usuario_nombre,
                fm2.nombre as motivo_nombre
             FROM fondos_movimientos fm
             JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
             LEFT JOIN usuarios u ON fm.usuario_id = u.id
             LEFT JOIN fondos_motivos fm2 ON fm.motivo_id = fm2.id
             WHERE fm.sesion_caja_id = $1
               AND cp.es_caja_operativa = true
             ORDER BY fm.created_at ASC`,
            [sesionId]
        );
        
        // 3. Calculate totals
        const movimientos = movimientosResult.rows;
        const totalIngresos = movimientos
            .filter(m => m.tipo === 'INGRESO' && ![FONDO_APERTURA_CAJA, FONDO_CIERRE_CAJA].includes(m.motivo_id))
            .reduce((sum, m) => sum + parseFloat(m.monto), 0);
        
        const totalEgresos = movimientos
            .filter(m => m.tipo === 'EGRESO' && ![FONDO_APERTURA_CAJA, FONDO_CIERRE_CAJA].includes(m.motivo_id))
            .reduce((sum, m) => sum + parseFloat(m.monto), 0);
        
        const saldoEsperado = parseFloat(sesion.saldo_apertura) + totalIngresos - totalEgresos;
        const diferencia = sesion.saldo_cierre_real !== null 
            ? parseFloat(sesion.saldo_cierre_real) - saldoEsperado 
            : null;
        
        res.json({
            fecha: targetDateStr,
            sesion: {
                id: sesion.id,
                estado: sesion.estado,
                apertura_fecha: sesion.apertura_fecha,
                cierre_fecha: sesion.cierre_fecha,
                saldo_apertura: parseFloat(sesion.saldo_apertura || 0),
                saldo_cierre_esperado: parseFloat(sesion.saldo_cierre_esperado || saldoEsperado),
                saldo_cierre_real: sesion.saldo_cierre_real ? parseFloat(sesion.saldo_cierre_real) : null,
                diferencia: diferencia,
                usuario_apertura_nombre: sesion.usuario_apertura_nombre,
                usuario_cierre_nombre: sesion.usuario_cierre_nombre,
                notas: sesion.notas
            },
            resumen: {
                saldo_apertura: parseFloat(sesion.saldo_apertura || 0),
                total_ingresos: totalIngresos,
                total_egresos: totalEgresos,
                saldo_cierre_esperado: saldoEsperado,
                saldo_cierre_real: sesion.saldo_cierre_real ? parseFloat(sesion.saldo_cierre_real) : null,
                diferencia: diferencia
            },
            movimientos: movimientos.map(m => ({
                id: m.id,
                fecha: m.created_at || m.fecha,
                cuenta_nombre: m.cuenta_nombre,
                tipo: m.tipo,
                motivo: m.motivo_id,
                motivo_nombre: m.motivo_nombre,
                descripcion: m.descripcion,
                monto: parseFloat(m.monto),
                saldo_anterior: parseFloat(m.saldo_anterior || 0),
                saldo_nuevo: parseFloat(m.saldo_nuevo || 0),
                usuario_nombre: m.usuario_nombre
            }))
        });
        
    } catch (error) {
        console.error('Daily cash report error:', error);
        res.status(500).json({ error: 'Error al obtener reporte de caja diario' });
    }
});

export default router;
