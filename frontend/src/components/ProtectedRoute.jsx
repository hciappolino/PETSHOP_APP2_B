import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { isAuthenticated, user } = useAuth();

    // Si no está autenticado, redirigir a login
    if (!isAuthenticated) {
        console.log('Usuario no autenticado, redirigiendo a /login');
        return <Navigate to="/login" replace />;
    }

    // Si hay roles permitidos y el usuario no tiene el rol correcto
    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.rol)) {
        console.log(`Acceso denegado. Rol requerido: [${allowedRoles.join(', ')}], Rol actual: ${user?.rol}`);
        return <Navigate to="/" replace />;
    }

    // Usuario autenticado y con permisos correctos
    return children;
};
