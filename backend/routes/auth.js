import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Login - Simple single company login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        const userResult = await pool.query(
            'SELECT * FROM usuarios WHERE username = $1 AND activo = true',
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

        // Generate token (no empresa_id)
        const token = generateToken(user);

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

export default router;
