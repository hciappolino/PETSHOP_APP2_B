import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all payment accounts
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { tipo, activo } = req.query;
        let query = 'SELECT * FROM cuentas_pago WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (tipo) {
            query += ` AND tipo = $${paramCount}`;
            params.push(tipo);
            paramCount++;
        }

        if (activo !== undefined) {
            query += ` AND activo = $${paramCount}`;
            params.push(activo === 'true');
            paramCount++;
        }

        query += ' ORDER BY activo DESC, nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get payment accounts error:', error);
        res.status(500).json({ error: 'Error al obtener cuentas de pago' });
    }
});

// Get total balance across all accounts
router.get('/balance-total', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT SUM(saldo_actual) as total FROM cuentas_pago WHERE activo = true',
            []
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get total balance error:', error);
        res.status(500).json({ error: 'Error al obtener balance total' });
    }
});

// Create new account
router.post('/', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { nombre, tipo, saldo_inicial = 0 } = req.body;

        if (!nombre || nombre.trim().length === 0) {
            return res.status(400).json({ error: 'El nombre de la cuenta es obligatorio' });
        }

        if (!tipo || !['EFECTIVO', 'BANCO', 'DIGITAL', 'EXTERNA'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de cuenta inválido. Use: EFECTIVO, BANCO, DIGITAL o EXTERNA' });
        }

        // Las cuentas EXTERNAS no son contabilizadas por defecto
        const esContabilizada = tipo !== 'EXTERNA';

        const result = await client.query(
            `INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, es_contabilizada, activo) 
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [nombre.trim(), tipo, parseFloat(saldo_inicial) || 0, esContabilizada, true]
        );

        // Si hay saldo inicial, crear movimiento
        if (parseFloat(saldo_inicial) > 0) {
            await client.query(
                `INSERT INTO fondos_movimientos 
                 (cuenta_id, tipo, monto, motivo, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    result.rows[0].id,
                    'INGRESO',
                    parseFloat(saldo_inicial),
                    'AJUSTE',
                    0,
                    parseFloat(saldo_inicial),
                    req.user.id,
                    'Saldo inicial al crear cuenta'
                ]
            );
        }

        res.status(201).json({
            message: 'Cuenta creada exitosamente',
            cuenta: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe una cuenta con ese nombre' });
        }
        console.error('Create account error:', error);
        res.status(500).json({ error: 'Error al crear cuenta: ' + error.message });
    } finally {
        client.release();
    }
});

// Update account
router.put('/:id', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, tipo, activo } = req.body;

        if (!nombre || nombre.trim().length === 0) {
            return res.status(400).json({ error: 'El nombre de la cuenta es obligatorio' });
        }

        if (!tipo || !['EFECTIVO', 'BANCO', 'DIGITAL', 'EXTERNA'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de cuenta inválido' });
        }

        const esContabilizada = tipo !== 'EXTERNA';

        const result = await pool.query(
            `UPDATE cuentas_pago 
             SET nombre = $1, tipo = $2, es_contabilizada = $3, activo = $4
             WHERE id = $5
             RETURNING *`,
            [nombre.trim(), tipo, esContabilizada, activo !== false, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }

        res.json({
            message: 'Cuenta actualizada exitosamente',
            cuenta: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe una cuenta con ese nombre' });
        }
        console.error('Update account error:', error);
        res.status(500).json({ error: 'Error al actualizar cuenta: ' + error.message });
    }
});

// Toggle account active status (soft delete - set activo = false)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // Verificar que la cuenta existe
        const checkResult = await client.query(
            'SELECT saldo_actual, activo FROM cuentas_pago WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }

        const cuenta = checkResult.rows[0];
        const nuevoEstado = !cuenta.activo;

        // Si se va a desactivar, verificar que no tenga saldo
        if (nuevoEstado === false && parseFloat(cuenta.saldo_actual) !== 0) {
            return res.status(400).json({ error: 'No se puede desactivar una cuenta con saldo. Balancee la cuenta primero.' });
        }

        // Verificar si tiene movimientos (solo para desactivar, no para activar)
        if (nuevoEstado === false) {
            const movimientosResult = await client.query(
                'SELECT COUNT(*) as count FROM fondos_movimientos WHERE cuenta_id = $1',
                [id]
            );
            const tieneMovimientos = parseInt(movimientosResult.rows[0].count) > 0;
            
            if (tieneMovimientos) {
                return res.status(400).json({ 
                    error: 'No se puede desactivar una cuenta con movimientos históricos. Esto preserva la trazabilidad. Si no desea verla en el POS, asegúrese de que sea tipo EXTERNA.' 
                });
            }
        }

        await client.query(
            'UPDATE cuentas_pago SET activo = $1 WHERE id = $2',
            [nuevoEstado, id]
        );

        const mensaje = nuevoEstado ? 'Cuenta activada exitosamente' : 'Cuenta desactivada exitosamente';
        res.json({ message: mensaje, activo: nuevoEstado });
    } catch (error) {
        console.error('Toggle account status error:', error);
        res.status(500).json({ error: 'Error al cambiar estado de cuenta: ' + error.message });
    } finally {
        client.release();
    }
});

// Balance account - transfer balance to another account
router.post('/:id/balancear', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { cuenta_destino_id } = req.body;

        if (!cuenta_destino_id) {
            return res.status(400).json({ error: 'Debe especificar la cuenta destino' });
        }

        if (parseInt(id) === parseInt(cuenta_destino_id)) {
            return res.status(400).json({ error: 'No puede transferir a la misma cuenta' });
        }

        await client.query('BEGIN');

        // Get source account
        const sourceResult = await client.query(
            'SELECT * FROM cuentas_pago WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (sourceResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Cuenta origen no encontrada' });
        }

        const sourceAccount = sourceResult.rows[0];
        const saldoATransferir = parseFloat(sourceAccount.saldo_actual);

        if (saldoATransferir === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La cuenta ya tiene saldo 0' });
        }

        // Get destination account
        const destResult = await client.query(
            'SELECT * FROM cuentas_pago WHERE id = $1 FOR UPDATE',
            [cuenta_destino_id]
        );

        if (destResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Cuenta destino no encontrada' });
        }

        const destAccount = destResult.rows[0];
        const saldoDestinoAnterior = parseFloat(destAccount.saldo_actual);
        
        // Calcular nuevos saldos según la lógica de balanceo
        // Si saldoATransferir es negativo (deuda), la cuenta destino debe "pagar" esa deuda
        // Si saldoATransferir es positivo, la cuenta destino recibe ese saldo
        const montoAbsoluto = Math.abs(saldoATransferir);
        const saldoDestinoNuevo = saldoDestinoAnterior - saldoATransferir; // Restamos porque transferimos el saldo
        const saldoSourceNuevo = 0;

        // Update source account (set to 0)
        await client.query(
            'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
            [saldoSourceNuevo, id]
        );

        // Update destination account
        await client.query(
            'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
            [saldoDestinoNuevo, cuenta_destino_id]
        );

        // Crear movimientos con lógica correcta:
        // - Si transferimos saldo positivo: origen EGRESO, destino INGRESO
        // - Si transferimos saldo negativo (deuda): origen INGRESO (se reduce deuda), destino EGRESO (se paga la deuda)
        
        const sourceTipo = saldoATransferir >= 0 ? 'EGRESO' : 'INGRESO';
        const destTipo = saldoATransferir >= 0 ? 'INGRESO' : 'EGRESO';
        
        // Create movement for source
        await client.query(
            `INSERT INTO fondos_movimientos 
             (cuenta_id, tipo, monto, motivo, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                id,
                sourceTipo,
                montoAbsoluto,
                'AJUSTE',
                saldoATransferir,
                saldoSourceNuevo,
                req.user.id,
                `Balanceo a cuenta: ${destAccount.nombre}`
            ]
        );

        // Create movement for destination
        await client.query(
            `INSERT INTO fondos_movimientos 
             (cuenta_id, tipo, monto, motivo, saldo_anterior, saldo_nuevo, usuario_id, descripcion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                cuenta_destino_id,
                destTipo,
                montoAbsoluto,
                'AJUSTE',
                saldoDestinoAnterior,
                saldoDestinoNuevo,
                req.user.id,
                `Balanceo desde cuenta: ${sourceAccount.nombre}`
            ]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Cuenta balanceada exitosamente',
            monto_transferido: saldoATransferir,
            cuenta_origen: sourceAccount.nombre,
            cuenta_destino: destAccount.nombre
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Balance account error:', error);
        res.status(500).json({ error: 'Error al balancear cuenta: ' + error.message });
    } finally {
        client.release();
    }
});

export default router;
