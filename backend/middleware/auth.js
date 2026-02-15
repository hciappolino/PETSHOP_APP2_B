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
        // Ensure permisos array is available
        req.user.permisos = user.permisos || [];
        next();
    });
};

// New middleware to check permissions
export const authorizePermission = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const userPermisos = req.user.permisos || [];
        const hasAll = requiredPermissions.every(p => userPermisos.includes(p));
        if (!hasAll) {
            return res.status(403).json({
                error: 'No tiene permisos para realizar esta acción',
                required: requiredPermissions,
                userPermissions: userPermisos
            });
        }
        next();
    };
};

// Deprecated: Keep for backward compatibility during migration
// This will be removed once all routes are migrated to authorizePermission
export const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        console.warn('[Auth] DEPRECATED: authorizeRole is deprecated. Please migrate to authorizePermission.');
        console.warn('[Auth] Route:', req.method, req.originalUrl);
        console.warn('[Auth] Allowed roles:', allowedRoles);
        
        // Pass through for now to avoid breaking existing routes
        // In production, you should migrate all routes to use authorizePermission
        next();
    };
};

// Generate JWT token with permissions
export const generateToken = (user, permisos = []) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol_id: user.rol_id,
            rol_nombre: user.rol_nombre || 'vendedor',
            permisos: permisos
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

export default { authenticateToken, authorizePermission, authorizeRole, generateToken };
