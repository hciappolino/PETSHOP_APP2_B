import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/roles - List all roles
router.get('/', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, 
                   (SELECT COUNT(*) FROM usuarios WHERE rol_id = r.id) as usuario_count
            FROM roles r 
            ORDER BY r.es_sistema DESC, r.id ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Error al obtener roles' });
    }
});

// GET /api/roles/:id - Get single role with permissions
router.get('/:id', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const roleResult = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }
        
        const permsResult = await pool.query(`
            SELECT p.*
            FROM permisos p
            JOIN rol_permisos rp ON p.id = rp.permiso_id
            WHERE rp.rol_id = $1
            ORDER BY p.modulo, p.orden
        `, [id]);
        
        res.json({
            ...roleResult.rows[0],
            permisos: permsResult.rows
        });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ error: 'Error al obtener rol' });
    }
});

// POST /api/roles - Create new role
router.post('/', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const { nombre, descripcion, permisos = [] } = req.body;
        
        if (!nombre) {
            return res.status(400).json({ error: 'Nombre del rol requerido' });
        }
        
        // Check if role name already exists
        const existing = await pool.query('SELECT id FROM roles WHERE nombre = $1', [nombre]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
        }
        
        // Create role
        const result = await pool.query(`
            INSERT INTO roles (nombre, descripcion, es_sistema)
            VALUES ($1, $2, false)
            RETURNING *
        `, [nombre, descripcion]);
        
        const roleId = result.rows[0].id;
        
        // Add permissions
        if (permisos.length > 0) {
            for (const permisoId of permisos) {
                await pool.query(
                    'INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [roleId, permisoId]
                );
            }
        }
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Error al crear rol' });
    }
});

// PUT /api/roles/:id - Update role (permissions)
router.put('/:id', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, permisos = [] } = req.body;
        
        // Check if role exists and is not a system role
        const existing = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }
        
        if (existing.rows[0].es_sistema) {
            return res.status(400).json({ error: 'No se puede modificar un rol del sistema' });
        }
        
        // Update role details
        await pool.query(
            'UPDATE roles SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion) WHERE id = $3',
            [nombre, descripcion, id]
        );
        
        // Replace all permissions
        await pool.query('DELETE FROM rol_permisos WHERE rol_id = $1', [id]);
        
        if (permisos.length > 0) {
            for (const permisoId of permisos) {
                await pool.query(
                    'INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, permisoId]
                );
            }
        }
        
        const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// DELETE /api/roles/:id - Delete role
router.delete('/:id', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if role exists and is not a system role
        const existing = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }
        
        if (existing.rows[0].es_sistema) {
            return res.status(400).json({ error: 'No se puede eliminar un rol del sistema' });
        }
        
        // Check if any users have this role
        const userCount = await pool.query('SELECT COUNT(*) as count FROM usuarios WHERE rol_id = $1', [id]);
        if (parseInt(userCount.rows[0].count) > 0) {
            return res.status(400).json({ error: 'No se puede eliminar un rol que tiene usuarios asignados' });
        }
        
        await pool.query('DELETE FROM rol_permisos WHERE rol_id = $1', [id]);
        await pool.query('DELETE FROM roles WHERE id = $1', [id]);
        
        res.json({ message: 'Rol eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Error al eliminar rol' });
    }
});

// GET /api/permisos - List all permissions (for building the UI)
router.get('/permisos/all', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM permisos 
            ORDER BY modulo, orden
        `);
        
        // Group by modulo
        const grouped = {};
        for (const perm of result.rows) {
            if (!grouped[perm.modulo]) {
                grouped[perm.modulo] = [];
            }
            grouped[perm.modulo].push(perm);
        }
        
        res.json({
            permisos: result.rows,
            grouped
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

export default router;
