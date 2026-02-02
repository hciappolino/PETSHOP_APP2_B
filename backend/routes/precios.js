import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get prices for all products by list
router.get('/lista/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT p.id, p.nombre, p.codigo, p.tipo_presentacion, p.costo_ultima_compra,
                    la.precio_venta_unidad, la.precio_venta_granel, la.updated_at
             FROM productos p
             LEFT JOIN lista_articulo la ON p.id = la.producto_id AND la.lista_precio_id = $1
             
             ORDER BY p.nombre`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get prices error:', error);
        res.status(500).json({ error: 'Error al obtener precios' });
    }
});

// Update specific product price in a list
router.post('/actualizar', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { lista_id, producto_id, precio_venta_unidad, precio_venta_granel } = req.body;
        if (!lista_id || !producto_id) {
            return res.status(400).json({ error: 'Lista y producto son requeridos' });
        }

        const result = await pool.query(
            `INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (lista_precio_id, producto_id) DO UPDATE SET
                precio_venta_unidad = EXCLUDED.precio_venta_unidad,
                precio_venta_granel = EXCLUDED.precio_venta_granel,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [ lista_id, producto_id, precio_venta_unidad, precio_venta_granel]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update price error:', error);
        res.status(500).json({ error: 'Error al actualizar precio' });
    }
});

export default router;
