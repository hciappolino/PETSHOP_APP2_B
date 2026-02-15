import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizePermission } from '../middleware/auth.js';

const router = express.Router();

// Get all providers
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { activo, search } = req.query;
        let query = 'SELECT * FROM proveedores WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (activo !== undefined) {
            query += ` AND activo = $${paramCount}`;
            params.push(activo === 'true');
            paramCount++;
        }

        if (search) {
            query += ` AND (nombre ILIKE $${paramCount} OR contacto ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

// Get provider by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM proveedores WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get provider error:', error);
        res.status(500).json({ error: 'Error al obtener proveedor' });
    }
});

// Create provider
router.post('/', authenticateToken, authorizePermission('proveedores.crear'), async (req, res) => {
    try {
        const { nombre, contacto, telefono, email, direccion } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const result = await pool.query(
            `INSERT INTO proveedores (nombre, contacto, telefono, email, direccion) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [ nombre, contacto, telefono, email, direccion]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create provider error:', error);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
});

// Update provider
router.put('/:id', authenticateToken, authorizePermission('proveedores.editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, contacto, telefono, email, direccion, activo } = req.body;

        const result = await pool.query(
            `UPDATE proveedores 
             SET nombre = COALESCE($1, nombre),
                 contacto = COALESCE($2, contacto),
                 telefono = COALESCE($3, telefono),
                 email = COALESCE($4, email),
                 direccion = COALESCE($5, direccion),
                 activo = COALESCE($6, activo)
             WHERE id = $7
             RETURNING *`,
            [nombre, contacto, telefono, email, direccion, activo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update provider error:', error);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
});

// Delete provider
router.delete('/:id', authenticateToken, authorizePermission('proveedores.editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM proveedores WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json({ message: 'Proveedor eliminado exitosamente' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({
                error: 'No se puede eliminar el proveedor porque tiene registros asociados'
            });
        }
        console.error('Delete provider error:', error);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});

export default router;
