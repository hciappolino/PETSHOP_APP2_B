import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is already logged in
        console.log('[DEBUG AuthContext] useEffect checking for existing session...');
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        console.log('[DEBUG AuthContext] localStorage token:', token ? 'present' : 'MISSING');
        console.log('[DEBUG AuthContext] localStorage user:', userData ? 'present' : 'MISSING');
        
        if (token && userData) {
            try {
                setUser(JSON.parse(userData));
                console.log('[DEBUG AuthContext] User restored from localStorage');
            } catch (e) {
                console.log('[DEBUG AuthContext] Error parsing user data, clearing storage');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } else {
            console.log('[DEBUG AuthContext] No token/user in localStorage - user is NOT authenticated');
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        console.log('[DEBUG AuthContext.login] Called with username:', username, 'password: [REDACTED]');
        console.log('[DEBUG AuthContext.login] Note: Login.jsx calls login(user) with user object, but this expects (username, password)!');
        const res = await api.post('/auth/login', { username, password });
        const { token, user: userData } = res.data;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    // Set user directly (used after successful login)
    const setUserDirect = (userData) => {
        console.log('[DEBUG AuthContext] setUserDirect called with:', userData);
        setUser(userData);
    };

    const refreshUser = async () => {
        try {
            const res = await api.get('/auth/me');
            const userData = res.data;
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            return userData;
        } catch (error) {
            logout();
            throw error;
        }
    };

    // Helper function to check if user has a specific permission
    const hasPermission = (permissionCode) => {
        if (!user || !user.permisos) return false;
        return user.permisos.includes(permissionCode);
    };

    // Helper function to check if user has ANY of the specified permissions
    const hasAnyPermission = (permissionCodes) => {
        if (!user || !user.permisos) return false;
        return permissionCodes.some(code => user.permisos.includes(code));
    };

    // Helper function to check if user has ALL of the specified permissions
    const hasAllPermissions = (permissionCodes) => {
        if (!user || !user.permisos) return false;
        return permissionCodes.every(code => user.permisos.includes(code));
    };

    // Legacy helpers for backward compatibility (deprecated, use hasPermission instead)
    const isAdmin = user?.rol_id === 1; // rol_id 1 is admin
    const isVendedor = user?.rol_id === 2; // rol_id 2 is vendedor
    // Note: isGerente is removed - use hasPermission() instead

    const value = {
        user,
        isAuthenticated: !!user,
        isAdmin,
        isVendedor,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        login,
        logout,
        setUserDirect,
        refreshUser,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
