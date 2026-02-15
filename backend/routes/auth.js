import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Login - With permissions system
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        // Query user with role info
        const userResult = await pool.query(
            'SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.username = $1 AND u.activo = true',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Query user's permissions
        const permisosResult = await pool.query(
            'SELECT p.codigo FROM permisos p JOIN rol_permisos rp ON p.id = rp.permiso_id WHERE rp.rol_id = $1',
            [user.rol_id]
        );

        const permisosCodes = permisosResult.rows.map(row => row.codigo);

        // Generate token with permissions
        const token = generateToken(user, permisosCodes);

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol_id: user.rol_id,
                rol_nombre: user.rol_nombre,
                permisos: permisosCodes
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

// Get current user info with permissions from database
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Query fresh user data with role info
        const userResult = await pool.query(
            'SELECT u.id, u.username, u.nombre, u.rol_id, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1 AND u.activo = true',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = userResult.rows[0];

        // Query user's permissions
        const permisosResult = await pool.query(
            'SELECT p.codigo FROM permisos p JOIN rol_permisos rp ON p.id = rp.permiso_id WHERE rp.rol_id = $1',
            [user.rol_id]
        );

        const permisosCodes = permisosResult.rows.map(row => row.codigo);

        res.json({
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol_id: user.rol_id,
            rol_nombre: user.rol_nombre,
            permisos: permisosCodes
        });

    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

export default router;
