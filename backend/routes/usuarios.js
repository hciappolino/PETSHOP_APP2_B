import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { authenticateToken, authorizePermission } from '../middleware/auth.js';

const router = express.Router();

// Get all users (public for init-db)
router.get('/', authenticateToken, authorizePermission('admin.usuarios'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.nombre, u.email, u.rol_id, r.nombre as rol_nombre, u.activo, u.created_at 
            FROM usuarios u 
            LEFT JOIN roles r ON u.rol_id = r.id
            ORDER BY u.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Get user by ID (public for init-db)
router.get('/:id', authenticateToken, authorizePermission('admin.usuarios'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT u.id, u.username, u.nombre, u.email, u.rol_id, r.nombre as rol_nombre, u.activo, u.created_at 
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            WHERE u.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});

// Create user (public for init-db)
router.post('/', authenticateToken, authorizePermission('admin.usuarios'), async (req, res) => {
    try {
        const { username, nombre, email, rol_id, rol, password, activo = true } = req.body;
        
        // Support both rol (string) and rol_id (integer) for backward compatibility
        const finalRolId = rol_id || (rol ? (rol.toLowerCase() === 'admin' ? 1 : rol.toLowerCase() === 'gerente' ? 1 : 2) : 2);
        
        // Validate required fields
        if (!username || !nombre || !password) {
            return res.status(400).json({ error: 'Username, nombre y contraseña son requeridos' });
        }
        
        // Validate role_id
        if (typeof finalRolId !== 'number' || finalRolId < 1 || finalRolId > 10) {
            return res.status(400).json({ error: 'ID de rol inválido' });
        }
        
        // Check if username exists
        const existingUser = await pool.query('SELECT id FROM usuarios WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'El username ya existe' });
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await pool.query(`
            INSERT INTO usuarios (username, password_hash, nombre, email, rol_id, activo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, nombre, email, rol_id, activo, created_at
        `, [username, passwordHash, nombre, email, finalRolId, activo]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Update user (public for init-db)
router.put('/:id', authenticateToken, authorizePermission('admin.usuarios'), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, nombre, email, rol_id, rol, activo, password } = req.body;
        
        // Support both rol (string) and rol_id (integer) for backward compatibility
        const finalRolId = rol_id || (rol ? (rol.toLowerCase() === 'admin' ? 1 : rol.toLowerCase() === 'gerente' ? 1 : 2) : null);
        
        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Validate role_id if provided
        if (finalRolId !== null && finalRolId !== undefined && typeof finalRolId === 'number' && (finalRolId < 1 || finalRolId > 10)) {
            return res.status(400).json({ error: 'ID de rol inválido' });
        }
        
        // Check if username is being changed and if new username exists
        if (username && username !== existingUser.rows[0].username) {
            const usernameCheck = await pool.query('SELECT id FROM usuarios WHERE username = $1', [username]);
            if (usernameCheck.rows.length > 0) {
                return res.status(400).json({ error: 'El username ya existe' });
            }
        }
        
        // Build update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;
        
        if (username) {
            updateFields.push(`username = $${paramCount++}`);
            updateValues.push(username);
        }
        if (nombre) {
            updateFields.push(`nombre = $${paramCount++}`);
            updateValues.push(nombre);
        }
        if (email) {
            updateFields.push(`email = $${paramCount++}`);
            updateValues.push(email);
        }
        if (finalRolId !== null && finalRolId !== undefined) {
            updateFields.push(`rol_id = ${paramCount++}`);
            updateValues.push(finalRolId);
        }
        if (activo !== undefined) {
            updateFields.push(`activo = $${paramCount++}`);
            updateValues.push(activo);
        }
        if (password) {
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            updateFields.push(`password_hash = $${paramCount++}`);
            updateValues.push(passwordHash);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        
        updateValues.push(id);
        
        const result = await pool.query(`
            UPDATE usuarios 
            SET ${updateFields.join(', ')} 
            WHERE id = ${paramCount}
            RETURNING id, username, nombre, email, rol_id, activo, created_at
        `, updateValues);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Delete user (public for init-db)
router.delete('/:id', authenticateToken, authorizePermission('admin.usuarios'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Prevent deleting admin user if it's the last admin
        if (existingUser.rows[0].rol_id === 1) {
            const adminCount = await pool.query('SELECT COUNT(*) FROM usuarios WHERE rol_id = $1', [1]);
            if (parseInt(adminCount.rows[0].count) === 1) {
                return res.status(400).json({ error: 'No se puede eliminar el último usuario administrador' });
            }
        }
        
        // Delete user
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        
        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// Update user role (public for init-db)
router.put('/:id/rol', authenticateToken, authorizePermission('admin.roles'), async (req, res) => {
    try {
        const { id } = req.params;
        const { rol_id, rol } = req.body;
        
        // Support both rol (string) and rol_id (integer) for backward compatibility
        const finalRolId = rol_id || (rol ? (rol.toLowerCase() === 'admin' ? 1 : rol.toLowerCase() === 'gerente' ? 1 : 2) : 2);
        
        // Validate role_id if provided
        if (rol_id && typeof rol_id === 'number' && (rol_id < 1 || rol_id > 10)) {
            return res.status(400).json({ error: 'ID de rol inválido' });
        }
        
        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Prevent removing admin role from last admin
        if (existingUser.rows[0].rol_id === 1 && finalRolId !== 1) {
            const adminCount = await pool.query('SELECT COUNT(*) FROM usuarios WHERE rol_id = $1', [1]);
            if (parseInt(adminCount.rows[0].count) === 1) {
                return res.status(400).json({ error: 'No se puede eliminar el último usuario administrador' });
            }
        }
        
        const result = await pool.query(`
            UPDATE usuarios 
            SET rol_id = $1 
            WHERE id = $2
            RETURNING id, username, nombre, email, rol_id, activo, created_at
        `, [finalRolId, id]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ error: 'Error al actualizar rol de usuario' });
    }
});

export default router;
