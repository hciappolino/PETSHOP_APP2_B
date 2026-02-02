import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all price lists
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { activo } = req.query;
        let query = 'SELECT * FROM listas_precios WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (activo !== undefined) {
            query += ` AND activo = $${paramCount}`;
            params.push(activo === 'true');
            paramCount++;
        }

        query += ' ORDER BY es_default DESC, nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get price lists error:', error);
        res.status(500).json({ error: 'Error al obtener listas de precios' });
    }
});

// Create price list
router.post('/', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { nombre, descripcion, margen_sugerido, es_default } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        await client.query('BEGIN');

        // If this list will be default, unset others
        if (es_default) {
            await client.query('UPDATE listas_precios SET es_default = false WHERE 1=1', []);
        }

        const result = await client.query(
            `INSERT INTO listas_precios (nombre, descripcion, margen_sugerido, es_default) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [ nombre, descripcion || null, margen_sugerido || 0, es_default || false]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create price list error:', error);
        res.status(500).json({ error: 'Error al crear lista de precios' });
    } finally {
        client.release();
    }
});

// Set default price list
router.post('/:id/set-default', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query('BEGIN');
        await client.query('UPDATE listas_precios SET es_default = false WHERE 1=1', []);
        const result = await client.query(
            'UPDATE listas_precios SET es_default = true WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Lista de precios no encontrada' });
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Set default price list error:', error);
        res.status(500).json({ error: 'Error al establecer lista predeterminada' });
    } finally {
        client.release();
    }
});

// Update items in a price list
router.post('/:id/items', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { items } = req.body; // [{producto_id, precio_venta_unidad, precio_venta_granel}]

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Se requiere un array de items' });
        }

        await client.query('BEGIN');

        for (const item of items) {
            const { producto_id, precio_venta_unidad, precio_venta_granel } = item;

            await client.query(
                `INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (lista_precio_id, producto_id) DO UPDATE SET
                    precio_venta_unidad = EXCLUDED.precio_venta_unidad,
                    precio_venta_granel = EXCLUDED.precio_venta_granel,
                    updated_at = CURRENT_TIMESTAMP`,
                [ id, producto_id, precio_venta_unidad, precio_venta_granel]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Precios actualizados exitosamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update price list items error:', error);
        res.status(500).json({ error: 'Error al actualizar precios de la lista' });
    } finally {
        client.release();
    }
});

export default router;
