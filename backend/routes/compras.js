import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Constantes de motivos
const MOTIVO_COMPRA = 2;  // stock_motivos.id para COMPRA
const MOTIVO_FONDO_COMPRA = 2;  // fondos_motivos.id para COMPRA

// Get all purchase invoices
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { proveedor_id, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT cf.*, p.nombre as proveedor_nombre 
            FROM compras_facturas cf
            JOIN proveedores p ON cf.proveedor_id = p.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (proveedor_id) {
            query += ` AND cf.proveedor_id = $${paramCount}`;
            params.push(proveedor_id);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND cf.fecha >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND cf.fecha <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }

        query += ' ORDER BY cf.fecha DESC, cf.id DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({ error: 'Error al obtener compras' });
    }
});

// Get purchase by ID with items
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Get invoice header
        const invoiceResult = await pool.query(
            `SELECT cf.*, p.nombre as proveedor_nombre 
             FROM compras_facturas cf
             JOIN proveedores p ON cf.proveedor_id = p.id
             WHERE cf.id = $1 `,
            [id]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        // Get invoice items
        const itemsResult = await pool.query(
            `SELECT cr.*, p.nombre as producto_nombre 
             FROM compras_renglones cr
             LEFT JOIN productos p ON cr.producto_id = p.id
             WHERE cr.factura_id = $1 
             ORDER BY cr.id`,
            [id]
        );

        res.json({
            ...invoiceResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        console.error('Get purchase detail error:', error);
        res.status(500).json({ error: 'Error al obtener detalle de la compra' });
    }
});

// Create purchase and update stock/costs
router.post('/', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            proveedor_id,
            numero_factura,
            fecha,
            items, // [{producto_id, descripcion, cantidad, precio_costo}]
            pago_inmediato,
            cuenta_pago_id,
            monto_pagado,
            referencia_pago,
            notas_pago
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un producto o gasto' });
        }

        await client.query('BEGIN');

        // 1. Create invoice header
        const invoiceResult = await client.query(
            `INSERT INTO compras_facturas (proveedor_id, numero_factura, fecha) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [ proveedor_id, numero_factura, fecha || new Date()]
        );

        const facturaId = invoiceResult.rows[0].id;

        // 2. Process each item
        for (const item of items) {
            const { producto_id, descripcion, cantidad, precio_costo } = item;

            // Save line item
            await client.query(
                `INSERT INTO compras_renglones (factura_id, producto_id, descripcion, cantidad, precio_costo) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [ facturaId, producto_id || null, descripcion || null, cantidad, precio_costo]
            );

            // ONLY if product is linked, update stock/costs and record movement
            if (producto_id) {
                // Atomic update to prevent race conditions
                const updateRes = await client.query(
                    `UPDATE productos 
                     SET stock_actual = stock_actual + $1,
                         costo_ultima_compra = $2
                     WHERE id = $3
                     RETURNING stock_actual, (stock_actual - $1) as stock_anterior`,
                    [cantidad, precio_costo, producto_id]
                );

                if (updateRes.rows.length === 0) {
                    throw new Error(`Producto ${producto_id} no encontrado`);
                }

                const { stock_actual: stockNuevo, stock_anterior: stockAnterior } = updateRes.rows[0];

                // Create stock movement record
                const movRes = await client.query(
                    `INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo_id, referencia_id, stock_anterior, stock_nuevo, usuario_id) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [ producto_id, 'ENTRADA', cantidad, MOTIVO_COMPRA, facturaId, stockAnterior, stockNuevo, req.user.id]
                );
                console.log('Stock movement created for purchase:', movRes.rows[0]?.id || 'unknown');
            }
        }

        // Apply immediate payment if requested
        if (pago_inmediato) {
            const totalResult = await client.query(
                'SELECT total FROM compras_facturas WHERE id = $1',
                [facturaId]
            );
            const totalFactura = parseFloat(totalResult.rows[0]?.total || 0);

            const montoPago = Math.min(
                totalFactura,
                Math.max(0, parseFloat(monto_pagado || totalFactura))
            );

            const cuentaId = parseInt(cuenta_pago_id);
            if (!cuentaId || !montoPago || montoPago <= 0) {
                throw new Error('Cuenta y monto vÃ¡lidos son obligatorios para pago inmediato');
            }

            if (montoPago > totalFactura) {
                throw new Error(`Monto excede el total. Total: $${totalFactura}, Intenta pagar: $${montoPago}`);
            }

            const accountResult = await client.query(
                `SELECT saldo_actual, es_contabilizada 
                 FROM cuentas_pago 
                 WHERE id = $1 AND activo = true`,
                [cuentaId]
            );

            if (accountResult.rows.length === 0) {
                throw new Error('Cuenta de pago no encontrada o inactiva');
            }

            const { saldo_actual: saldoAnterior, es_contabilizada } = accountResult.rows[0];
            if (es_contabilizada && parseFloat(saldoAnterior) < montoPago) {
                throw new Error(`Saldo insuficiente. Disponible: $${saldoAnterior}, Intenta descontar: $${montoPago}`);
            }

            const paymentResult = await client.query(
                `INSERT INTO pagos_compra (factura_id, cuenta_pago_id, monto, referencia, notas, usuario_id) 
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [facturaId, cuentaId, montoPago, referencia_pago || null, notas_pago || null, req.user.id]
            );

            const nuevoMontoPagado = montoPago;
            const isPaid = nuevoMontoPagado >= totalFactura;
            await client.query(
                `UPDATE compras_facturas 
                 SET monto_pagado = $1, pagado = $2 
                 WHERE id = $3`,
                [nuevoMontoPagado, isPaid, facturaId]
            );

            const nuevoSaldo = parseFloat(saldoAnterior) - montoPago;
            await client.query(
                `UPDATE cuentas_pago 
                 SET saldo_actual = $1 
                 WHERE id = $2`,
                [nuevoSaldo, cuentaId]
            );

            await client.query(
                `INSERT INTO fondos_movimientos 
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    cuentaId,
                    'EGRESO',
                    montoPago,
                    MOTIVO_FONDO_COMPRA,
                    facturaId,
                    saldoAnterior,
                    nuevoSaldo,
                    req.user.id,
                    `Pago inmediato de factura #${facturaId}${referencia_pago ? ` - Ref: ${referencia_pago}` : ''}`
                ]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Compra registrada exitosamente',
            factura_id: facturaId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Purchase creation error:', error);
        res.status(500).json({ error: 'Error al registrar la compra: ' + error.message });
    } finally {
        client.release();
    }
});

// ===========================
// CUENTAS & PAYMENT ENDPOINTS
// ===========================

// List all accounts (contabilizadas and externas) - MUST BE BEFORE /:id routes
router.get('/cuentas/listar', authenticateToken, async (req, res) => {
    try {
        const { incluirInactivas } = req.query;
        let query = `SELECT * FROM cuentas_pago`;
        const params = [];

        if (!incluirInactivas) {
            query += ` WHERE activo = true`;
        }

        query += ` ORDER BY es_contabilizada DESC, nombre ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('List accounts error:', error);
        res.status(500).json({ error: 'Error al obtener cuentas' });
    }
});

// Create external account for diverse expenses (no contabilizada)
router.post('/cuentas-externas/crear', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion } = req.body;

        if (!nombre || nombre.trim().length === 0) {
            return res.status(400).json({ error: 'El nombre de la cuenta es obligatorio' });
        }

        const result = await pool.query(
            `INSERT INTO cuentas_pago (nombre, tipo, es_contabilizada, saldo_actual) 
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [nombre, tipo || 'EXTERNA', false, 0]
        );

        res.status(201).json({
            message: 'Cuenta externa creada',
            cuenta: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe una cuenta con ese nombre' });
        }
        console.error('Create external account error:', error);
        res.status(500).json({ error: 'Error al crear cuenta: ' + error.message });
    }
});

// Get all payments for a purchase invoice
router.get('/:id/pagos', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT pc.*, cp.nombre as cuenta_nombre, u.nombre as usuario_nombre,
                    cf.numero_factura, cf.total as factura_total
             FROM pagos_compra pc
             JOIN cuentas_pago cp ON pc.cuenta_pago_id = cp.id
             JOIN usuarios u ON pc.usuario_id = u.id
             JOIN compras_facturas cf ON pc.factura_id = cf.id
             WHERE pc.factura_id = $1
             ORDER BY pc.fecha_pago DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get purchase payments error:', error);
        res.status(500).json({ error: 'Error al obtener pagos' });
    }
});

// Register payment for a purchase (connects with fondos_movimientos)
router.post('/:id/pagar', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        let { cuenta_pago_id, monto, referencia, notas } = req.body;

        console.log(`\n📥 RECIBIDO PAGO:`, { id, cuenta_pago_id, monto, referencia, notas, tipo_monto: typeof monto });

        // Convert monto to number
        monto = parseFloat(monto);
        cuenta_pago_id = parseInt(cuenta_pago_id);

        console.log(`🔄 CONVERTIDO:`, { monto, cuenta_pago_id, tipo_monto: typeof monto });

        if (!cuenta_pago_id || !monto || monto <= 0) {
            console.log(`❌ VALIDACIÓN FALLIDA: cuenta_pago_id=${cuenta_pago_id}, monto=${monto}`);
            return res.status(400).json({ error: 'Cuenta y monto válidos son obligatorios' });
        }

        await client.query('BEGIN');
        console.log(`✓ TRANSACCIÓN INICIADA`);

        // 1. Verify invoice exists and get details
        const invoiceResult = await client.query(
            `SELECT id, total, monto_pagado FROM compras_facturas WHERE id = $1`,
            [id]
        );

        if (invoiceResult.rows.length === 0) {
            console.log(`❌ FACTURA NO ENCONTRADA: id=${id}`);
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const { total, monto_pagado } = invoiceResult.rows[0];
        const montoPagadoActual = parseFloat(monto_pagado) || 0;
        const nuevoMontoPagado = montoPagadoActual + monto;

        console.log(`💳 PAGO FACTURA #${id}: Monto=${monto}, Anterior=${montoPagadoActual}, Nuevo=${nuevoMontoPagado}, Total=${total}`);

        if (nuevoMontoPagado > total) {
            console.log(`❌ MONTO EXCEDE TOTAL`);
            return res.status(400).json({ 
                error: `Monto excede el total. Total: $${total}, Ya pagado: $${montoPagadoActual}, Intenta pagar: $${monto}` 
            });
        }

        // 2. Verify account exists and has funds
        const accountResult = await client.query(
            `SELECT saldo_actual, es_contabilizada FROM cuentas_pago WHERE id = $1 AND activo = true`,
            [cuenta_pago_id]
        );

        if (accountResult.rows.length === 0) {
            console.log(`❌ CUENTA NO ENCONTRADA: id=${cuenta_pago_id}`);
            return res.status(404).json({ error: 'Cuenta de pago no encontrada o inactiva' });
        }

        const { saldo_actual: saldoAnterior, es_contabilizada } = accountResult.rows[0];

        console.log(`💰 CUENTA: saldo=${saldoAnterior}, contabilizada=${es_contabilizada}`);

        // Check balance only for contabilized accounts
        if (es_contabilizada && saldoAnterior < monto) {
            console.log(`❌ SALDO INSUFICIENTE`);
            return res.status(400).json({ 
                error: `Saldo insuficiente. Disponible: $${saldoAnterior}, Intenta descontar: $${monto}` 
            });
        }

        // 3. Record the payment
        const paymentResult = await client.query(
            `INSERT INTO pagos_compra (factura_id, cuenta_pago_id, monto, referencia, notas, usuario_id) 
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [id, cuenta_pago_id, monto, referencia || null, notas || null, req.user.id]
        );

        const paymentId = paymentResult.rows[0].id;
        console.log(`✓ PAGO REGISTRADO: id=${paymentId}`);

        // 4. Update invoice payment status
        const isPaid = nuevoMontoPagado >= total;
        const updateResult = await client.query(
            `UPDATE compras_facturas 
             SET monto_pagado = $1, pagado = $2 
             WHERE id = $3
             RETURNING *`,
            [nuevoMontoPagado, isPaid, id]
        );
        console.log(`✓ FACTURA ACTUALIZADA:`, { 
            id: updateResult.rows[0].id, 
            monto_pagado: updateResult.rows[0].monto_pagado, 
            pagado: updateResult.rows[0].pagado 
        });

        // 5. Update account balance (EGRESO = negative for payment)
        const nuevoSaldo = saldoAnterior - monto;
        await client.query(
            `UPDATE cuentas_pago 
             SET saldo_actual = $1 
             WHERE id = $2`,
            [nuevoSaldo, cuenta_pago_id]
        );
        console.log(`✓ CUENTA ACTUALIZADA: saldo_anterior=${saldoAnterior}, saldo_nuevo=${nuevoSaldo}`);

        // 6. Create fondos_movimiento record (EGRESO = payment)
        const movResult = await client.query(
            `INSERT INTO fondos_movimientos 
             (cuenta_id, tipo, monto, motivo_id, referencia_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                cuenta_pago_id,
                'EGRESO',
                monto,
                MOTIVO_FONDO_COMPRA,
                id,
                saldoAnterior,
                nuevoSaldo,
                req.user.id,
                `Pago de factura #${id}${referencia ? ` - Ref: ${referencia}` : ''}`
            ]
        );

        console.log(`✓ MOVIMIENTO FONDOS REGISTRADO: id=${movResult.rows[0].id}`);

        await client.query('COMMIT');
        console.log(`✓ TRANSACCIÓN COMPLETADA\n`);

        res.status(201).json({
            message: 'Pago registrado exitosamente',
            pago_id: paymentId,
            movimiento_id: movResult.rows[0].id,
            factura_pagada: isPaid,
            monto_pagado: nuevoMontoPagado,
            total_factura: total
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ ERROR EN PAGO:`, error.message);
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el pago: ' + error.message });
    } finally {
        client.release();
    }
});

export default router;
