import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_in_production';

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('[Auth] Token verification failed:', err.message);
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        console.log('[Auth] User from token:', JSON.stringify(user));
        req.user = user;
        next();
    });
};

// Middleware to check user role
export const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        // Safety check for undefined rol
        const userRol = req.user.rol || '';
        
        console.log('[Auth] Role check:', {
            url: req.originalUrl,
            method: req.method,
            userRol: userRol,
            userRolType: typeof userRol,
            allowedRoles: allowedRoles,
            includesResult: allowedRoles.includes(userRol),
            charCodes: userRol.split('').map(c => c.charCodeAt(0))
        });

        if (!allowedRoles.includes(userRol)) {
            return res.status(403).json({
                error: 'No tiene permisos para realizar esta acción',
                requiredRoles: allowedRoles,
                userRole: userRol
            });
        }

        next();
    };
};

// Generate JWT token (no empresa_id needed)
export const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol: user.rol
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

export default { authenticateToken, authorizeRole, generateToken };
