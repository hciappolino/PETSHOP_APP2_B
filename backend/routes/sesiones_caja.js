import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Constantes de motivos para fondos
const FONDO_APERTURA_CAJA = 7;
const FONDO_CIERRE_CAJA = 8;
const FONDO_AJUSTE_CAJA = 9;

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

// Get current open session with real-time expected balance (operative cash only)
router.get('/current', authenticateToken, async (req, res) => {
    try {
        // This query filters movements to ONLY include the operative cash account
        const result = await pool.query(
            `SELECT sc.*, u.nombre as usuario_nombre,
                sc.saldo_apertura + COALESCE((
                    SELECT SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END)
                    FROM fondos_movimientos fm
                    JOIN cuentas_pago cp ON fm.cuenta_id = cp.id
                    WHERE fm.sesion_caja_id = sc.id 
                      AND cp.es_caja_operativa = true
                      AND fm.motivo_id NOT IN (${FONDO_APERTURA_CAJA}, ${FONDO_CIERRE_CAJA})
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
    const client = await pool.connect();
    try {
        const { monto_inicial, notas } = req.body;
        const montoInicial = parseFloat(monto_inicial) || 0;

        const openCheck = await client.query(
            "SELECT id FROM sesiones_caja WHERE estado = 'ABIERTA'",
            []
        );
        if (openCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una sesión de caja abierta' });
        }

        await client.query('BEGIN');

        // Operative and fund accounts
        const cuentasRes = await client.query(
            `SELECT id, saldo_actual, es_caja_operativa, es_caja_fondo
             FROM cuentas_pago
             WHERE es_caja_operativa = true OR es_caja_fondo = true
             FOR UPDATE`
        );
        const cuentaOperativa = cuentasRes.rows.find(r => r.es_caja_operativa);
        const cuentaFondo = cuentasRes.rows.find(r => r.es_caja_fondo);
        if (!cuentaOperativa || !cuentaFondo) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Debe existir Caja Operativa y Caja Fondo configuradas.' });
        }

        // Create session
        const result = await client.query(
            `INSERT INTO sesiones_caja (usuario_apertura_id, estado, saldo_apertura, notas) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [ req.user.id, 'ABIERTA', montoInicial, notas]
        );

        // Transfer from fondo -> operativa for initial cash
        if (montoInicial > 0) {
            const saldoFondoAnterior = parseFloat(cuentaFondo.saldo_actual || 0);
            const saldoOperativaAnterior = parseFloat(cuentaOperativa.saldo_actual || 0);
            const saldoFondoNuevo = saldoFondoAnterior - montoInicial;
            const saldoOperativaNuevo = saldoOperativaAnterior + montoInicial;

            await client.query(
                'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
                [saldoFondoNuevo, cuentaFondo.id]
            );
            await client.query(
                'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
                [saldoOperativaNuevo, cuentaOperativa.id]
            );

            await client.query(
                `INSERT INTO fondos_movimientos
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [
                    cuentaFondo.id,
                    'EGRESO',
                    montoInicial,
                    FONDO_APERTURA_CAJA,
                    result.rows[0].id,
                    result.rows[0].id,
                    saldoFondoAnterior,
                    saldoFondoNuevo,
                    req.user.id,
                    'Transferencia a Caja Operativa (apertura)'
                ]
            );

            await client.query(
                `INSERT INTO fondos_movimientos
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [
                    cuentaOperativa.id,
                    'INGRESO',
                    montoInicial,
                    FONDO_APERTURA_CAJA,
                    result.rows[0].id,
                    result.rows[0].id,
                    saldoOperativaAnterior,
                    saldoOperativaNuevo,
                    req.user.id,
                    'Transferencia desde Caja Fondo (apertura)'
                ]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Open session error:', error);
        res.status(500).json({ error: 'Error al abrir sesión de caja' });
    } finally {
        client.release();
    }
});

// Close session and calculate final expected balance/difference (operative cash only)
router.post('/:id/close', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { monto_final_real, notas } = req.body;

        await client.query('BEGIN');

        // 1. Find operative cash account
        const cuentaRes = await client.query(
            `SELECT id, saldo_actual FROM cuentas_pago WHERE es_caja_operativa = true LIMIT 1 FOR UPDATE`
        );
        if (cuentaRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No existe una cuenta marcada como Caja Operativa.' });
        }
        const cuentaOperativaId = cuentaRes.rows[0].id;
        const saldoCuentaAnterior = parseFloat(cuentaRes.rows[0].saldo_actual || 0);

        // 2. Calculate final expected balance for operative cash
        const expectedResult = await client.query(
            `SELECT sc.saldo_apertura + COALESCE((
                    SELECT SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END)
                    FROM fondos_movimientos fm
                    WHERE fm.sesion_caja_id = sc.id 
                      AND fm.cuenta_id = $2
                      AND fm.motivo_id NOT IN (${FONDO_APERTURA_CAJA}, ${FONDO_CIERRE_CAJA})
                ), 0) as final_esperado
             FROM sesiones_caja sc
             WHERE sc.id = $1 `,
            [id, cuentaOperativaId]
        );

        if (expectedResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        const finalEsperado = parseFloat(expectedResult.rows[0].final_esperado);
        const diferencia = parseFloat(monto_final_real) - finalEsperado;

        // 3. Create adjustment movement if needed
        if (diferencia !== 0) {
            const tipoAjuste = diferencia > 0 ? 'INGRESO' : 'EGRESO';
            const montoAjuste = Math.abs(diferencia);
            const saldoCuentaNuevo = saldoCuentaAnterior + diferencia;

            await client.query(
                `UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2`,
                [saldoCuentaNuevo, cuentaOperativaId]
            );

            await client.query(
                `INSERT INTO fondos_movimientos
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [
                    cuentaOperativaId,
                    tipoAjuste,
                    montoAjuste,
                    FONDO_AJUSTE_CAJA,
                    id,
                    id,
                    saldoCuentaAnterior,
                    saldoCuentaNuevo,
                    req.user.id,
                    'Ajuste por cierre de caja'
                ]
            );
        }

        // 4. Transfer operative cash back to fund account
        const cuentaFondoRes = await client.query(
            `SELECT id, saldo_actual FROM cuentas_pago WHERE es_caja_fondo = true LIMIT 1 FOR UPDATE`
        );
        if (cuentaFondoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No existe una cuenta marcada como Caja Fondo.' });
        }
        const cuentaFondoId = cuentaFondoRes.rows[0].id;
        const saldoFondoAnterior = parseFloat(cuentaFondoRes.rows[0].saldo_actual || 0);
        const saldoOperativaActual = parseFloat((await client.query(
            'SELECT saldo_actual FROM cuentas_pago WHERE id = $1',
            [cuentaOperativaId]
        )).rows[0].saldo_actual || 0);

        const montoTransferir = parseFloat(monto_final_real) || 0;
        if (montoTransferir > 0) {
            const saldoOperativaNuevo = saldoOperativaActual - montoTransferir;
            const saldoFondoNuevo = saldoFondoAnterior + montoTransferir;

            await client.query(
                'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
                [saldoOperativaNuevo, cuentaOperativaId]
            );
            await client.query(
                'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
                [saldoFondoNuevo, cuentaFondoId]
            );

            await client.query(
                `INSERT INTO fondos_movimientos
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [
                    cuentaOperativaId,
                    'EGRESO',
                    montoTransferir,
                    FONDO_CIERRE_CAJA,
                    id,
                    id,
                    saldoOperativaActual,
                    saldoOperativaNuevo,
                    req.user.id,
                    'Transferencia a Caja Fondo (cierre)'
                ]
            );

            await client.query(
                `INSERT INTO fondos_movimientos
                 (cuenta_id, tipo, monto, motivo_id, referencia_id, sesion_caja_id, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [
                    cuentaFondoId,
                    'INGRESO',
                    montoTransferir,
                    FONDO_CIERRE_CAJA,
                    id,
                    id,
                    saldoFondoAnterior,
                    saldoFondoNuevo,
                    req.user.id,
                    'Transferencia desde Caja Operativa (cierre)'
                ]
            );
        }

        // 5. Update session with final results
        const result = await client.query(
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
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La sesión ya está cerrada o no existe' });
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Close session error:', error);
        res.status(500).json({ error: 'Error al cerrar sesión de caja' });
    } finally {
        client.release();
    }
});

export default router;
