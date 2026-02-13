import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Mapeo de motivos texto a IDs para ajustes manuales
const MOTIVO_MAP = {
    'AJUSTE': 3,
    'APERTURA_BOLSA': 4,
    'DEVOLUCION': 5
};

const MOTIVO_INVERSO_TIPO = {
    3: 'ENTRADA',   // AJUSTE revertido
    4: 'ENTRADA',   // APERTURA_BOLSA revertida
    5: 'SALIDA'     // DEVOLUCION revertida
};

// Get stock movements
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { producto_id, fecha_desde, fecha_hasta, motivo } = req.query;

        let query = `
            SELECT sm.*, p.nombre as producto_nombre, p.fabricante, p.marca, 
                   u.nombre as usuario_nombre, sm2.nombre as motivo_nombre
            FROM stock_movimientos sm
            JOIN productos p ON sm.producto_id = p.id
            JOIN usuarios u ON sm.usuario_id = u.id
            LEFT JOIN stock_motivos sm2 ON sm.motivo_id = sm2.id
            WHERE sm.revertido = false
        `;
        const params = [];
        let paramCount = 1;

        if (producto_id) {
            query += ` AND sm.producto_id = ${paramCount}`;
            params.push(producto_id);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND sm.created_at >= ${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND sm.created_at <= ${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }

        // Filtrar por código de motivo (numérico)
        if (motivo) {
            query += ` AND sm.motivo_id = ${paramCount}`;
            params.push(parseInt(motivo));
            paramCount++;
        }

        query += ' ORDER BY sm.created_at DESC, sm.id DESC LIMIT 200';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get stock movements error:', error);
        res.status(500).json({ error: 'Error al obtener movimientos de stock' });
    }
});

export default router;

// Create a stock movement (manual)
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { producto_id, tipo, cantidad, motivo, referencia_id, notas } = req.body;

        if (!producto_id || !tipo || !cantidad) {
            return res.status(400).json({ error: 'Faltan datos requeridos: producto_id, tipo, cantidad' });
        }

        // Validar tipo
        if (!['ENTRADA', 'SALIDA'].includes(tipo)) {
            return res.status(400).json({ error: "Tipo inválido. Debe ser 'ENTRADA' o 'SALIDA'" });
        }

        // Validación: APERTURA_BOLSA SIEMPRE debe ser SALIDA
        if (motivo === 'APERTURA_BOLSA' && tipo !== 'SALIDA') {
            return res.status(400).json({ error: "APERTURA_BOLSA debe tener tipo 'SALIDA'" });
        }

        await client.query('BEGIN');

        const prodRes = await client.query('SELECT stock_actual FROM productos WHERE id = $1 FOR UPDATE', [producto_id]);
        if (prodRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const stockAnterior = parseFloat(prodRes.rows[0].stock_actual || 0);
        const cantidadNum = parseFloat(cantidad);
        const stockNuevo = tipo === 'ENTRADA' ? stockAnterior + cantidadNum : stockAnterior - cantidadNum;

        await client.query('UPDATE productos SET stock_actual = $1 WHERE id = $2', [stockNuevo, producto_id]);

        // Obtener motivo_id
        const motivoId = motivo ? MOTIVO_MAP[motivo] : 3; // Default AJUSTE
        const motivoTexto = motivo || 'AJUSTE';

        const insertRes = await client.query(
            `INSERT INTO stock_movimientos
             (producto_id, tipo, cantidad, motivo_id, referencia_id, stock_anterior, stock_nuevo, usuario_id, notas)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [producto_id, tipo, cantidadNum, motivoId, referencia_id || null, stockAnterior, stockNuevo, req.user.id, notas || `[${motivoTexto}]`]
        );

        await client.query('COMMIT');
        res.status(201).json(insertRes.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create stock movement error:', error);
        res.status(500).json({ error: 'Error al crear movimiento de stock' });
    } finally {
        client.release();
    }
});
