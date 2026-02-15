import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizePermission } from '../middleware/auth.js';

const router = express.Router();

// Constante de motivo para DEPOSITO (pago de cliente)
const FONDO_DEPOSITO = 4;

// Get deudores (clients with saldo_cc > 0)
router.get('/reportes/deudores', authenticateToken, async (req, res) => {
    try {
        const { search, sortBy } = req.query;
        let query = 'SELECT id, nombre, dni_cuit, telefono, email, direccion, saldo_cc, activo, created_at FROM clientes WHERE saldo_cc > 0 AND activo = true';
        const params = [];
        let paramCount = 1;

        if (search) {
            query += ` AND (nombre ILIKE ${paramCount} OR dni_cuit ILIKE ${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        // Apply sorting
        if (sortBy === 'saldo_asc') {
            query += ' ORDER BY saldo_cc ASC';
        } else if (sortBy === 'nombre') {
            query += ' ORDER BY nombre ASC';
        } else {
            // Default: saldo_desc
            query += ' ORDER BY saldo_cc DESC';
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get deudores error:', error);
        res.status(500).json({ error: 'Error al obtener deudores' });
    }
});

// Get all clients
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { activo, search } = req.query;
        let query = 'SELECT * FROM clientes WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (activo !== undefined) {
            query += ` AND activo = $${paramCount}`;
            params.push(activo === 'true');
            paramCount++;
        }

        if (search) {
            query += ` AND (nombre ILIKE $${paramCount} OR dni_cuit ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// Get client by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM clientes WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// Get client account statement
router.get('/:id/cuenta-corriente', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Get client info
        const clientResult = await pool.query(
            'SELECT id, nombre, saldo_cc FROM clientes WHERE id = $1',
            [id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Get sales on account
        const salesResult = await pool.query(
            `SELECT v.id, v.fecha, v.total as monto, 'VENTA' as tipo, v.tipo_venta
             FROM ventas v
             WHERE v.cliente_id = $1 AND v.tipo_venta = 'CUENTA_CORRIENTE'
             ORDER BY v.fecha DESC`,
            [id]
        );

        // Get payments registered for this client
        const paymentsResult = await pool.query(
            `SELECT fm.id, fm.created_at as fecha, fm.monto, 'PAGO' as tipo, fm.descripcion
             FROM fondos_movimientos fm
             WHERE fm.referencia_id = $1 AND fm.tipo = 'INGRESO' AND fm.motivo_id = $2
             ORDER BY fm.created_at DESC`,
            [id, FONDO_DEPOSITO]
        );

        // Combine and sort by date
        const movimientos = [...salesResult.rows, ...paymentsResult.rows]
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 50);

        res.json({
            cliente: clientResult.rows[0],
            movimientos: movimientos
        });
    } catch (error) {
        console.error('Get account statement error:', error);
        res.status(500).json({ error: 'Error al obtener cuenta corriente' });
    }
});

// Create client
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { nombre, dni_cuit, telefono, email, direccion, saldo_cc } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const result = await pool.query(
            `INSERT INTO clientes (nombre, dni_cuit, telefono, email, direccion, saldo_cc) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [nombre, dni_cuit, telefono, email, direccion, saldo_cc || 0]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, dni_cuit, telefono, email, direccion, saldo_cc, activo } = req.body;

        const result = await pool.query(
            `UPDATE clientes 
             SET nombre = COALESCE($1, nombre),
                 dni_cuit = COALESCE($2, dni_cuit),
                 telefono = COALESCE($3, telefono),
                 email = COALESCE($4, email),
                 direccion = COALESCE($5, direccion),
                 saldo_cc = COALESCE($6, saldo_cc),
                 activo = COALESCE($7, activo)
             WHERE id = $8
             RETURNING *`,
            [nombre, dni_cuit, telefono, email, direccion, saldo_cc, activo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// Delete client
router.delete('/:id', authenticateToken, authorizePermission('clientes.eliminar'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM clientes WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ message: 'Cliente eliminado exitosamente' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({
                error: 'No se puede eliminar el cliente porque tiene registros asociados'
            });
        }
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

// Register a payment from client to their cuenta corriente
router.post('/:id/pagos', authenticateToken, async (req, res) => {
    const clientConn = await pool.connect();
    try {
        const { id } = req.params;
        const { monto, cuenta_pago_id, referencia, notas } = req.body;
        const userId = req.user?.id;

        console.log('POST /pagos - Request:', { id, monto, cuenta_pago_id, userId });

        if (!monto || parseFloat(monto) <= 0) {
            return res.status(400).json({ error: 'El monto es requerido y debe ser mayor a 0' });
        }

        if (!cuenta_pago_id) {
            return res.status(400).json({ error: 'Cuenta de pago es requerida' });
        }

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const montoNum = parseFloat(monto);
        if (Number.isNaN(montoNum) || montoNum <= 0) {
            return res.status(400).json({ error: 'El monto debe ser un numero valido mayor a 0' });
        }

        await clientConn.query('BEGIN');

        const clientRes = await clientConn.query('SELECT id, nombre, saldo_cc FROM clientes WHERE id = $1 FOR UPDATE', [id]);
        if (clientRes.rows.length === 0) {
            await clientConn.query('ROLLBACK');
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        const saldoAdeudado = parseFloat(clientRes.rows[0].saldo_cc || 0);
        if (saldoAdeudado <= 0) {
            await clientConn.query('ROLLBACK');
            return res.status(400).json({ error: 'El cliente no tiene deuda pendiente' });
        }
        if (montoNum > saldoAdeudado) {
            await clientConn.query('ROLLBACK');
            return res.status(400).json({
                error: `El pago no puede superar lo adeudado (${saldoAdeudado.toFixed(2)})`
            });
        }

        // Verify payment account
        const accountRes = await clientConn.query(
            'SELECT id, saldo_actual, es_caja_operativa FROM cuentas_pago WHERE id = $1 FOR UPDATE',
            [cuenta_pago_id]
        );
        if (accountRes.rows.length === 0) {
            await clientConn.query('ROLLBACK');
            return res.status(404).json({ error: 'Cuenta de pago no encontrada' });
        }

        const saldoAnterior = parseFloat(accountRes.rows[0].saldo_actual || 0);
        const saldoNuevo = saldoAnterior + montoNum;
        const esCajaOperativa = !!accountRes.rows[0].es_caja_operativa;
        let sesionCajaId = null;

        // Si el destino es Caja Operativa, asociar el movimiento a la caja ABIERTA del dia.
        if (esCajaOperativa) {
            const sesionRes = await clientConn.query(
                `SELECT id
                 FROM sesiones_caja
                 WHERE estado = 'ABIERTA'
                 ORDER BY apertura_fecha DESC
                 LIMIT 1`
            );
            if (sesionRes.rows.length === 0) {
                await clientConn.query('ROLLBACK');
                return res.status(400).json({ error: 'No hay caja abierta para registrar este pago en Caja Operativa' });
            }
            sesionCajaId = sesionRes.rows[0].id;
        }

        // Anti-duplicado: bloquea reintentos inmediatos del mismo pago.
        const duplicateRes = await clientConn.query(
            `SELECT id, created_at
             FROM fondos_movimientos fm
             WHERE fm.cuenta_id = $1
               AND fm.tipo = 'INGRESO'
               AND fm.motivo_id = $2
               AND fm.referencia_id = $3
               AND fm.usuario_id = $4
               AND fm.monto = $5
               AND (
                    ($6::int IS NULL AND fm.sesion_caja_id IS NULL)
                    OR fm.sesion_caja_id = $6
               )
               AND fm.created_at >= (CURRENT_TIMESTAMP - INTERVAL '15 seconds')
             ORDER BY fm.created_at DESC
             LIMIT 1`,
            [cuenta_pago_id, FONDO_DEPOSITO, id, userId, montoNum, sesionCajaId]
        );
        if (duplicateRes.rows.length > 0) {
            await clientConn.query('ROLLBACK');
            return res.status(409).json({ error: 'Pago duplicado detectado. Reintento bloqueado.' });
        }

        // Update payment account balance
        await clientConn.query('UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2', [saldoNuevo, cuenta_pago_id]);

        // Insert fund movement (INGRESO)
        await clientConn.query(
            `INSERT INTO fondos_movimientos (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                cuenta_pago_id,
                'INGRESO',
                montoNum,
                FONDO_DEPOSITO,
                id,
                sesionCajaId,
                saldoAnterior,
                saldoNuevo,
                userId,
                notas || referencia || `Pago cliente ${id}`
            ]
        );

        // Decrease client saldo_cc
        await clientConn.query('UPDATE clientes SET saldo_cc = saldo_cc - $1 WHERE id = $2', [montoNum, id]);

        await clientConn.query('COMMIT');

        res.status(201).json({ message: 'Pago registrado correctamente' });
    } catch (error) {
        try {
            await clientConn.query('ROLLBACK');
        } catch (e) {
            // ignore rollback errors
        }
        console.error('Register client payment error:', error);
        res.status(500).json({ error: 'Error al registrar pago: ' + error.message });
    } finally {
        clientConn.release();
    }
});

export default router;
