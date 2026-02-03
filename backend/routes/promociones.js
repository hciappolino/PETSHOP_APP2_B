import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all promotions
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { activo, tipo } = req.query;
        
        let query = `
            SELECT p.*, u.username as usuario_crea_nombre
            FROM promociones p
            LEFT JOIN usuarios u ON p.usuario_crea_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (activo !== undefined) {
            query += ` AND p.activo = $${paramCount}`;
            params.push(activo === 'true');
            paramCount++;
        }

        if (tipo) {
            query += ` AND p.tipo = $${paramCount}`;
            params.push(tipo);
            paramCount++;
        }

        query += ' ORDER BY p.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get promociones error:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
});

// Get active promotions for a product
router.get('/producto/:productoId', authenticateToken, async (req, res) => {
    try {
        const { productoId } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM fn_get_promociones_producto($1)',
            [productoId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get producto promociones error:', error);
        res.status(500).json({ error: 'Error al obtener promociones del producto' });
    }
});

// Get all active promotions (for POS)
router.get('/activas', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM v_promociones_actuales
            ORDER BY prioridad DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get activas error:', error);
        res.status(500).json({ error: 'Error al obtener promociones activas' });
    }
});

// Get promotion by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM promociones WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get promocion error:', error);
        res.status(500).json({ error: 'Error al obtener promoción' });
    }
});

// Create promotion
router.post('/', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const {
            nombre,
            descripcion,
            tipo,
            valor_descuento,
            ambito_aplicacion,
            entidad_id,
            cantidad_minima,
            fecha_inicio,
            fecha_fin,
            uso_maximo,
            prioridad,
            stackeable
        } = req.body;

        const usuario_crea_id = req.user.id;

        const result = await pool.query(`
            INSERT INTO promociones (
                nombre, descripcion, tipo, valor_descuento, ambito_aplicacion,
                entidad_id, cantidad_minima, fecha_inicio, fecha_fin,
                uso_maximo, prioridad, stackeable, usuario_crea_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            nombre, descripcion, tipo, valor_descuento, ambito_aplicacion,
            entidad_id, cantidad_minima, fecha_inicio, fecha_fin,
            uso_maximo, prioridad || 0, stackeable || false, usuario_crea_id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create promocion error:', error);
        res.status(500).json({ error: 'Error al crear promoción' });
    }
});

// Update promotion
router.put('/:id', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            descripcion,
            tipo,
            valor_descuento,
            ambito_aplicacion,
            entidad_id,
            cantidad_minima,
            fecha_inicio,
            fecha_fin,
            activo,
            uso_maximo,
            prioridad,
            stackeable
        } = req.body;

        const result = await pool.query(`
            UPDATE promociones SET
                nombre = COALESCE($1, nombre),
                descripcion = COALESCE($2, descripcion),
                tipo = COALESCE($3, tipo),
                valor_descuento = COALESCE($4, valor_descuento),
                ambito_aplicacion = COALESCE($5, ambito_aplicacion),
                entidad_id = COALESCE($6, entidad_id),
                cantidad_minima = COALESCE($7, cantidad_minima),
                fecha_inicio = COALESCE($8, fecha_inicio),
                fecha_fin = COALESCE($9, fecha_fin),
                activo = COALESCE($10, activo),
                uso_maximo = COALESCE($11, uso_maximo),
                prioridad = COALESCE($12, prioridad),
                stackeable = COALESCE($13, stackeable)
            WHERE id = $14
            RETURNING *
        `, [
            nombre, descripcion, tipo, valor_descuento, ambito_aplicacion,
            entidad_id, cantidad_minima, fecha_inicio, fecha_fin,
            activo, uso_maximo, prioridad, stackeable, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update promocion error:', error);
        res.status(500).json({ error: 'Error al actualizar promoción' });
    }
});

// Cancel/Deactivate promotion
router.put('/:id/cancelar', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE promociones SET activo = false WHERE id = $1 RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        res.json({ message: 'Promoción cancelada', promocion: result.rows[0] });
    } catch (error) {
        console.error('Cancel promocion error:', error);
        res.status(500).json({ error: 'Error al cancelar promoción' });
    }
});

// Delete promotion
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check for usages
        const usageCheck = await pool.query(
            'SELECT COUNT(*) FROM promocion_usos WHERE promocion_id = $1',
            [id]
        );

        if (parseInt(usageCheck.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar la promoción porque tiene usos registrados. Cancélela en su lugar.' 
            });
        }

        const result = await pool.query(
            'DELETE FROM promociones WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        res.json({ message: 'Promoción eliminada' });
    } catch (error) {
        console.error('Delete promocion error:', error);
        res.status(500).json({ error: 'Error al eliminar promoción' });
    }
});

// Get promotion usage statistics
router.get('/:id/estadisticas', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [promocion, totalUsos, usoMaximo] = await Promise.all([
            pool.query('SELECT * FROM promociones WHERE id = $1', [id]),
            pool.query('SELECT COUNT(*) FROM promocion_usos WHERE promocion_id = $1', [id]),
            pool.query('SELECT uso_maximo, uso_actual FROM promociones WHERE id = $1', [id])
        ]);

        if (promocion.rows.length === 0) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        const recentUsos = await pool.query(`
            SELECT pu.*, v.total as venta_total, c.nombre as cliente_nombre
            FROM promocion_usos pu
            LEFT JOIN ventas v ON pu.venta_id = v.id
            LEFT JOIN clientes c ON pu.cliente_id = c.id
            WHERE pu.promocion_id = $1
            ORDER BY pu.used_at DESC
            LIMIT 20
        `, [id]);

        res.json({
            promocion: promocion.rows[0],
            total_usos: parseInt(totalUsos.rows[0].count),
            limite_usos: usoMaximo.rows[0].uso_maximo,
            usos_restantes: usoMaximo.rows[0].uso_maximo 
                ? usoMaximo.rows[0].uso_maximo - usoMaximo.rows[0].uso_actual 
                : null,
            usos_detalles: recentUsos.rows
        });
    } catch (error) {
        console.error('Get estadisticas error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Get dropdown options for entity selection
router.get('/opciones/entidades', authenticateToken, async (req, res) => {
    try {
        const { ambito } = req.query;

        let result;
        switch (ambito) {
            case 'producto':
                result = await pool.query(
                    'SELECT id, nombre, codigo, marca FROM productos WHERE activo = true ORDER BY nombre'
                );
                break;
            case 'categoria':
                result = await pool.query(
                    'SELECT id, nombre FROM listas_precios WHERE activo = true ORDER BY nombre'
                );
                break;
            case 'marca':
                result = await pool.query(`
                    SELECT DISTINCT marca as nombre FROM productos 
                    WHERE marca IS NOT NULL AND marca != '' AND activo = true 
                    ORDER BY marca
                `);
                // Add id for display
                result.rows = result.rows.map((row, idx) => ({ id: idx + 1, nombre: row.nombre }));
                break;
            case 'fabricante':
                result = await pool.query(`
                    SELECT DISTINCT fabricante as nombre FROM productos 
                    WHERE fabricante IS NOT NULL AND fabricante != '' AND activo = true 
                    ORDER BY fabricante
                `);
                result.rows = result.rows.map((row, idx) => ({ id: idx + 1, nombre: row.nombre }));
                break;
            default:
                return res.json({ productos: [], categorias: [], marcas: [], fabricantes: [] });
        }

        res.json(result.rows);
    } catch (error) {
        console.error('Get opciones error:', error);
        res.status(500).json({ error: 'Error al obtener opciones' });
    }
});

export default router;
