import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get financial movements
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { cuenta_id, sesion_caja_id, tipo, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT fm.*, cp.nombre as cuenta_nombre, u.nombre as usuario_nombre 
            FROM fondos_movimientos fm
            JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
            JOIN usuarios u ON fm.usuario_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (cuenta_id) {
            query += ` AND fm.cuenta_id = $${paramCount}`;
            params.push(cuenta_id);
            paramCount++;
        }

        if (sesion_caja_id) {
            query += ` AND fm.sesion_caja_id = $${paramCount}`;
            params.push(sesion_caja_id);
            paramCount++;
        }

        if (tipo) {
            query += ` AND fm.tipo = $${paramCount}`;
            params.push(tipo);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND fm.created_at >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND fm.created_at <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }

        query += ' ORDER BY fm.created_at DESC, fm.id DESC LIMIT 200';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get financial movements error:', error);
        res.status(500).json({ error: 'Error al obtener movimientos de fondos' });
    }
});

export default router;

// Create a fund movement (manual)
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { cuenta_id, tipo, monto, motivo, referencia_id, sesion_caja_id, descripcion } = req.body;

        if (!cuenta_id || !tipo || !monto) {
            return res.status(400).json({ error: 'Faltan datos requeridos: cuenta_id, tipo, monto' });
        }

        if (!['INGRESO', 'EGRESO'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo inválido. Debe ser INGRESO o EGRESO' });
        }

        const montoNum = parseFloat(monto);
        if (isNaN(montoNum) || montoNum <= 0) {
            return res.status(400).json({ error: 'El monto debe ser un número positivo mayor a 0' });
        }

        await client.query('BEGIN');

        const accRes = await client.query('SELECT saldo_actual FROM cuentas_pago WHERE id = $1 FOR UPDATE', [cuenta_id]);
        if (accRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Cuenta de pago no encontrada' });
        }

        const saldoAnterior = parseFloat(accRes.rows[0].saldo_actual || 0);
        const saldoNuevo = tipo === 'INGRESO' ? saldoAnterior + montoNum : saldoAnterior - montoNum;

        await client.query('UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2', [saldoNuevo, cuenta_id]);

        const insertRes = await client.query(
            `INSERT INTO fondos_movimientos
             (cuenta_id, tipo, monto, motivo, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING *`,
            [cuenta_id, tipo, montoNum, motivo || null, referencia_id || null, sesion_caja_id || null, saldoAnterior, saldoNuevo, req.user.id, descripcion || null]
        );

        await client.query('COMMIT');
        res.status(201).json(insertRes.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create fund movement error:', error);
        res.status(500).json({ error: 'Error al crear movimiento de fondos' });
    } finally {
        client.release();
    }
});
