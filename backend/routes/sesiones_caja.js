import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all sessions
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { estado, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT sc.*, u.nombre as usuario_nombre 
            FROM sesiones_caja sc
            JOIN usuarios u ON sc.usuario_apertura_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (estado) {
            query += ` AND sc.estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND sc.apertura_fecha >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND sc.apertura_fecha <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }

        query += ' ORDER BY sc.apertura_fecha DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Error al obtener sesiones de caja' });
    }
});

// Get current open session with real-time expected balance (ONLY CASH)
router.get('/current', authenticateToken, async (req, res) => {
    try {
        // This query filters movements to ONLY include accounts of type 'EFECTIVO'
        const result = await pool.query(
            `SELECT sc.*, u.nombre as usuario_nombre,
                sc.saldo_apertura + COALESCE((
                    SELECT SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END)
                    FROM fondos_movimientos fm
                    JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
                    WHERE fm.sesion_caja_id = sc.id AND cp.tipo = 'EFECTIVO'
                ), 0) as saldo_cierre_esperado
             FROM sesiones_caja sc
             JOIN usuarios u ON sc.usuario_apertura_id = u.id
             WHERE sc.estado = 'ABIERTA' 
             ORDER BY sc.apertura_fecha DESC 
             LIMIT 1`,
            []
        );
        res.json(result.rows[0] || null);
    } catch (error) {
        console.error('Get current session error:', error);
        res.status(500).json({ error: 'Error al obtener sesión actual' });
    }
});

// Open new session
router.post('/open', authenticateToken, async (req, res) => {
    try {
        const { monto_inicial, notas } = req.body;

        const openCheck = await pool.query(
            "SELECT id FROM sesiones_caja WHERE estado = 'ABIERTA'",
            []
        );
        if (openCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una sesión de caja abierta' });
        }

        const result = await pool.query(
            `INSERT INTO sesiones_caja (usuario_apertura_id, estado, saldo_apertura, notas) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [ req.user.id, 'ABIERTA', monto_inicial || 0, notas]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Open session error:', error);
        res.status(500).json({ error: 'Error al abrir sesión de caja' });
    }
});

// Close session and calculate final expected balance/difference (ONLY CASH)
router.post('/:id/close', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { monto_final_real, notas } = req.body;

        // 1. Calculate final expected balance for CASH
        const expectedResult = await pool.query(
            `SELECT sc.saldo_apertura + COALESCE((
                    SELECT SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END)
                    FROM fondos_movimientos fm
                    JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
                    WHERE fm.sesion_caja_id = sc.id AND cp.tipo = 'EFECTIVO'
                ), 0) as final_esperado
             FROM sesiones_caja sc
             WHERE sc.id = $1 `,
            [id]
        );

        if (expectedResult.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        const finalEsperado = parseFloat(expectedResult.rows[0].final_esperado);
        const diferencia = parseFloat(monto_final_real) - finalEsperado;

        // 2. Update session with final results
        const result = await pool.query(
            `UPDATE sesiones_caja 
             SET estado = 'CERRADA',
                 cierre_fecha = CURRENT_TIMESTAMP,
                 saldo_cierre_esperado = $1,
                 saldo_cierre_real = $2,
                 diferencia = $3,
                 usuario_cierre_id = $4,
                 notas = COALESCE($5, notas)
             WHERE id = $6 AND estado = 'ABIERTA'
             RETURNING *`,
            [finalEsperado, monto_final_real, diferencia, req.user.id, notas, id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'La sesión ya está cerrada o no existe' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Close session error:', error);
        res.status(500).json({ error: 'Error al cerrar sesión de caja' });
    }
});

export default router;
