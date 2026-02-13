import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Constantes de motivos (ID = 1 = VENTA)
const MOTIVO_VENTA = 1;
const MOTIVO_FONDO_VENTA = 1; // fondos_motivos.id para VENTA

// Get all sales
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { cliente_id, fecha_desde, fecha_hasta, sesion_caja_id } = req.query;
        let query = `
            SELECT v.*, c.nombre as cliente_nombre, u.nombre as usuario_nombre, cp.nombre as cuenta_pago_nombre
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN usuarios u ON v.usuario_id = u.id
            LEFT JOIN cuentas_pago cp ON v.cuenta_pago_id = cp.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (cliente_id) {
            query += ` AND v.cliente_id = $${paramCount}`;
            params.push(cliente_id);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND v.fecha >= $${paramCount}::date`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND v.fecha < $${paramCount}::date + interval '1 day'`;
            params.push(fecha_hasta);
            paramCount++;
        }

        if (sesion_caja_id) {
            query += ` AND v.sesion_caja_id = $${paramCount}`;
            params.push(sesion_caja_id);
            paramCount++;
        }

        query += ' ORDER BY v.fecha DESC, v.id DESC LIMIT 100';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

// Get sale by ID with items
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const saleResult = await pool.query(
            `SELECT v.*, c.nombre as cliente_nombre, u.nombre as usuario_nombre
             FROM ventas v
             LEFT JOIN clientes c ON v.cliente_id = c.id
             LEFT JOIN usuarios u ON v.usuario_id = u.id
             WHERE v.id = $1 `,
            [id]
        );

        if (saleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }

        const itemsResult = await pool.query(
            `SELECT vi.*, p.nombre as producto_nombre, p.codigo as producto_codigo
             FROM venta_items vi
             LEFT JOIN productos p ON vi.producto_id = p.id
             WHERE vi.venta_id = $1 
             ORDER BY vi.id`,
            [id]
        );

        res.json({
            ...saleResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        console.error('Get sale error:', error);
        res.status(500).json({ error: 'Error al obtener venta' });
    }
});

// Create sale (POS)
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { cliente_id, items, cuenta_pago_id, tipo_venta, lista_precio_id, notas, descuento_total } = req.body;

            if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un item' });
        }

            // If the sale is not on account, require a payment account
            if ((tipo_venta || 'CONTADO') !== 'CUENTA_CORRIENTE' && !cuenta_pago_id) {
                return res.status(400).json({ error: 'Debe seleccionar una forma de pago para ventas al contado' });
            }

        await client.query('BEGIN');

        // Get lista_precio_id (default if not specified)
        let listaId = lista_precio_id;
        if (!listaId) {
            const defaultList = await client.query(
                'SELECT id FROM listas_precios WHERE es_default = true LIMIT 1',
                []
            );
            if (defaultList.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'No hay lista de precios predeterminada' });
            }
            listaId = defaultList.rows[0].id;
        }

        // For sales that are NOT account sales, require an open cash session and assign it
        let sesionCajaId = null;
        if ((tipo_venta || 'CONTADO') !== 'CUENTA_CORRIENTE') {
            const sessionResult = await client.query(
                'SELECT id FROM sesiones_caja WHERE estado = $1 ORDER BY apertura_fecha DESC LIMIT 1',
                [ 'ABIERTA']
            );

            if (sessionResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'No hay una sesión de caja abierta. Debe abrir caja antes de realizar ventas.' });
            }

            sesionCajaId = sessionResult.rows[0].id;
        }

        // Create sale header
        const saleResult = await client.query(
            `INSERT INTO ventas (cliente_id, lista_precio_id, cuenta_pago_id, sesion_caja_id, usuario_id, tipo_venta, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [ cliente_id, listaId, cuenta_pago_id || null, sesionCajaId, req.user.id, tipo_venta || 'CONTADO', notas]
        );

        const ventaId = saleResult.rows[0].id;

        // Register promotion usage
        const { promociones_aplicadas } = req.body;
        if (promociones_aplicadas && Array.isArray(promociones_aplicadas)) {
            for (const promo of promociones_aplicadas) {
                // Update promotion usage count
                await client.query(
                    'UPDATE promociones SET uso_actual = uso_actual + 1 WHERE id = $1',
                    [promo.promocion_id]
                );
                
                // Record the usage
                await client.query(
                    `INSERT INTO promocion_usos (promocion_id, venta_id, cliente_id, descuento_aplicado)
                     VALUES ($1, $2, $3, $4)`,
                    [promo.promocion_id, ventaId, cliente_id, promo.descuento_aplicado]
                );
            }
        }

        // Insert items and update stock
        let subtotalVenta = 0;
        for (const item of items) {
            const { producto_id, cantidad, precio_venta, es_granel } = item;
            subtotalVenta += parseFloat(cantidad) * parseFloat(precio_venta);

            await client.query(
                `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_venta, es_granel)
                 VALUES ($1, $2, $3, $4, $5)`,
                [ ventaId, producto_id, cantidad, precio_venta, es_granel || false]
            );

            // Update stock ONLY IF NOT granel
            if (!es_granel) {
                // Atomic update to prevent race conditions
                const updateRes = await client.query(
                    `UPDATE productos 
                     SET stock_actual = stock_actual - $1 
                     WHERE id = $2
                     RETURNING stock_actual, (stock_actual + $1) as stock_anterior`,
                    [cantidad, producto_id]
                );

                if (updateRes.rows.length === 0) {
                    throw new Error(`Producto ${producto_id} no encontrado`);
                }

                const { stock_actual: stockNuevo, stock_anterior: stockAnterior } = updateRes.rows[0];

                const movResult = await client.query(
                    `INSERT INTO stock_movimientos 
                    (producto_id, tipo, cantidad, motivo_id, referencia_id, stock_anterior, stock_nuevo, usuario_id, notas)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [ producto_id, 'SALIDA', cantidad, MOTIVO_VENTA, ventaId,
                        stockAnterior, stockNuevo, req.user.id, 'Venta por unidad'
                    ]
                );
                console.log('Stock movement created:', movResult.rows[0]?.id || 'unknown');
            }
        }

        // Apply discount at sale level to keep totals consistent
        const descuento = Math.max(
            0,
            Math.min(
                subtotalVenta,
                parseFloat(descuento_total || 0)
            )
        );
        const total = Math.max(0, subtotalVenta - descuento);

        await client.query(
            'UPDATE ventas SET total = $1, descuento_total = $2 WHERE id = $3',
            [total, descuento, ventaId]
        );

        // If this was a cash/point-of-sale sale, update payment account and create fund movement
        if ((tipo_venta || 'CONTADO') !== 'CUENTA_CORRIENTE') {
            const accountResult = await client.query(
                'SELECT saldo_actual FROM cuentas_pago WHERE id = $1',
                [cuenta_pago_id]
            );

            if (accountResult.rows.length === 0) {
                throw new Error(`Cuenta de pago ${cuenta_pago_id} no encontrada`);
            }

            const saldoAnterior = parseFloat(accountResult.rows[0].saldo_actual);
            const saldoNuevo = saldoAnterior + total;

            await client.query(
                'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
                [saldoNuevo, cuenta_pago_id]
            );

            const fundResult = await client.query(
                `INSERT INTO fondos_movimientos 
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [ cuenta_pago_id, 'INGRESO', total, MOTIVO_FONDO_VENTA, ventaId, sesionCajaId, saldoAnterior, saldoNuevo, req.user.id, `Venta ID: ${ventaId}`]
            );
            console.log('Fund movement created:', fundResult.rows[0]?.id || 'unknown');
        }

        // Update client account if cuenta corriente
        if (tipo_venta === 'CUENTA_CORRIENTE' && cliente_id) {
            await client.query(
                'UPDATE clientes SET saldo_cc = saldo_cc + $1 WHERE id = $2',
                [total, cliente_id]
            );
        }

        await client.query('COMMIT');

        const completeResult = await client.query(
            `SELECT v.*, c.nombre as cliente_nombre
             FROM ventas v
             LEFT JOIN clientes c ON v.cliente_id = c.id
             WHERE v.id = $1 `,
            [ventaId]
        );

        res.status(201).json({
            message: 'Venta registrada exitosamente',
            venta: completeResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create sale error:', error);
        res.status(500).json({ error: 'Error al crear venta: ' + error.message });
    } finally {
        client.release();
    }
});

// Cancel sale
router.post('/:id/cancelar', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        if (!motivo || motivo.trim() === '') {
            return res.status(400).json({ error: 'Debe proporcionar un motivo para cancelar la venta' });
        }

        await client.query('BEGIN');

        // Check if sale exists and is not already cancelled
        const saleCheck = await client.query(
            'SELECT * FROM ventas WHERE id = $1 FOR UPDATE',
            [id]
        );
        
        if (saleCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        const sale = saleCheck.rows[0];
        
        if (sale.cancelada) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La venta ya está cancelada' });
        }

        // Get sale items
        const itemsResult = await client.query(
            'SELECT * FROM venta_items WHERE venta_id = $1',
            [id]
        );

        // Restore stock for each non-granel item
        for (const item of itemsResult.rows) {
            if (!item.es_granel) {
                await client.query(
                    'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
                    [item.cantidad, item.producto_id]
                );
            }
        }

        // Mark stock movements as reverted (instead of creating new movements)
        // Update all stock movements for this venta to revertido = true
        await client.query(
            `UPDATE stock_movimientos 
             SET revertido = true, 
                 revertido_fecha = CURRENT_TIMESTAMP,
                 revertido_por = $1,
                 revertido_motivo = $2
             WHERE referencia_id = $3 AND motivo_id = $4 AND revertido = false`,
            [req.user.id, motivo, id, MOTIVO_VENTA]
        );

        // Mark fund movements as reverted (instead of creating new movements)
        if (sale.cuenta_pago_id && sale.tipo_venta !== 'CUENTA_CORRIENTE') {
            // Update account balance (EGRESO effect by removing the INGRESO)
            await client.query(
                'UPDATE cuentas_pago SET saldo_actual = saldo_actual - $1 WHERE id = $2',
                [sale.total, sale.cuenta_pago_id]
            );
            
            // Find the original VENTA fund movement
            const fundMovCheck = await client.query(
                'SELECT id FROM fondos_movimientos WHERE referencia_id = $1 AND motivo_id = $2 AND revertido = false',
                [id, MOTIVO_FONDO_VENTA]
            );
            
            if (fundMovCheck.rows.length > 0) {
                // Mark as reverted instead of creating new movement
                await client.query(
                    `UPDATE fondos_movimientos 
                     SET revertido = true, 
                         revertido_fecha = CURRENT_TIMESTAMP,
                         revertido_por = $1,
                         revertido_motivo = $2
                     WHERE referencia_id = $3 AND motivo_id = $4 AND revertido = false`,
                    [req.user.id, motivo, id, MOTIVO_FONDO_VENTA]
                );
            }
        }

        // Reverse client CC if CUENTA_CORRIENTE
        if (sale.tipo_venta === 'CUENTA_CORRIENTE' && sale.cliente_id) {
            await client.query(
                'UPDATE clientes SET saldo_cc = saldo_cc - $1 WHERE id = $2',
                [sale.total, sale.cliente_id]
            );
        }

        // Decrement promotion usage counts
        const promoUsos = await client.query(
            'SELECT * FROM promocion_usos WHERE venta_id = $1',
            [id]
        );
        
        for (const uso of promoUsos.rows) {
            await client.query(
                'UPDATE promociones SET uso_actual = uso_actual - 1 WHERE id = $1',
                [uso.promocion_id]
            );
        }

        // Mark sale as cancelled
        await client.query(
            `UPDATE ventas SET 
                cancelada = true, 
                cancelada_fecha = CURRENT_TIMESTAMP,
                cancelada_usuario_id = $1,
                cancelada_motivo = $2
             WHERE id = $3`,
            [req.user.id, motivo, id]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Venta cancelada exitosamente',
            venta_id: id
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Cancel sale error:', error);
        res.status(400).json({ error: 'Error al cancelar venta: ' + error.message });
    } finally {
        client.release();
    }
});

export default router;
