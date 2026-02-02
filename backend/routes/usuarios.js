import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users (public for init-db)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, username, nombre, email, rol, activo, created_at 
            FROM usuarios 
            ORDER BY created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Get user by ID (public for init-db)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT id, username, nombre, email, rol, activo, created_at 
            FROM usuarios 
            WHERE id = $1
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
router.post('/', async (req, res) => {
    try {
        const { username, nombre, email, rol, password, activo = true } = req.body;
        
        // Validate required fields
        if (!username || !nombre || !rol || !password) {
            return res.status(400).json({ error: 'Username, nombre, rol y contraseña son requeridos' });
        }
        
        // Validate role
        const validRoles = ['admin', 'gerente', 'vendedor'];
        if (!validRoles.includes(rol.toLowerCase())) {
            return res.status(400).json({ error: 'Rol inválido. Los roles válidos son: admin, gerente, vendedor' });
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
            INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, nombre, email, rol, activo, created_at
        `, [username, passwordHash, nombre, email, rol.toLowerCase(), activo]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Update user (public for init-db)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, nombre, email, rol, activo, password } = req.body;
        
        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Validate role
        if (rol) {
            const validRoles = ['admin', 'gerente', 'vendedor'];
            if (!validRoles.includes(rol.toLowerCase())) {
                return res.status(400).json({ error: 'Rol inválido. Los roles válidos son: admin, gerente, vendedor' });
            }
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
        if (rol) {
            updateFields.push(`rol = $${paramCount++}`);
            updateValues.push(rol.toLowerCase());
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
            WHERE id = $${paramCount}
            RETURNING id, username, nombre, email, rol, activo, created_at
        `, updateValues);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Delete user (public for init-db)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Prevent deleting admin user if it's the last admin
        if (existingUser.rows[0].rol === 'admin') {
            const adminCount = await pool.query('SELECT COUNT(*) FROM usuarios WHERE rol = $1', ['admin']);
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
router.put('/:id/rol', async (req, res) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;
        
        // Validate role
        const validRoles = ['admin', 'gerente', 'vendedor'];
        if (!validRoles.includes(rol.toLowerCase())) {
            return res.status(400).json({ error: 'Rol inválido. Los roles válidos son: admin, gerente, vendedor' });
        }
        
        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Prevent removing admin role from last admin
        if (existingUser.rows[0].rol === 'admin' && rol.toLowerCase() !== 'admin') {
            const adminCount = await pool.query('SELECT COUNT(*) FROM usuarios WHERE rol = $1', ['admin']);
            if (parseInt(adminCount.rows[0].count) === 1) {
                return res.status(400).json({ error: 'No se puede eliminar el último usuario administrador' });
            }
        }
        
        const result = await pool.query(`
            UPDATE usuarios 
            SET rol = $1 
            WHERE id = $2
            RETURNING id, username, nombre, email, rol, activo, created_at
        `, [rol.toLowerCase(), id]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ error: 'Error al actualizar rol de usuario' });
    }
});

export default router;
