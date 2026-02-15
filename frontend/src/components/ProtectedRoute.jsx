import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requiredPermission = null, allowedRoles = [] }) => {
    const { isAuthenticated, user, hasPermission } = useAuth();

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
        console.log('Usuario no autenticado, redirigiendo a /login');
        return <Navigate to="/login" replace />;
    }

    // If specific permission is required
    if (requiredPermission && !hasPermission(requiredPermission)) {
        console.log(`Acceso denegado. Permiso requerido: ${requiredPermission}`);
        console.log('Permisos del usuario:', user?.permisos);
        return <Navigate to="/" replace />;
    }

    // Legacy: If roles are specified (backward compatibility)
    if (allowedRoles.length > 0) {
        const rolId = user?.rol_id;
        // Map role names to IDs for legacy support
        // rol_id 1 = admin, 2 = vendedor (others = custom)
        const roleMap = { 'admin': 1, 'vendedor': 2 };
        const hasLegacyRole = allowedRoles.some(r => roleMap[r] === rolId);
        if (!hasLegacyRole) {
            console.log(`Acceso denegado. Rol requerido: [${allowedRoles.join(', ')}], Rol actual: ${user?.rol_nombre}`);
            return <Navigate to="/" replace />;
        }
    }

    // User authenticated and has permission (or no specific permission required)
    return children;
};
