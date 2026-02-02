import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Login.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    // Simple login for single-company architecture
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { username, password });
            const { token, user } = response.data;

            // Save token and user info
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));

            // Update auth context
            login(user);

            // Navigate to dashboard
            navigate('/');
        } catch (error) {
            setError(error.response?.data?.error || 'Error al iniciar sesión. Verifique credenciales.');
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">🐾</div>
                    <h1>Pet Shop</h1>
                    <p>Sistema de Gestión</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && <div className="alert alert-danger">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username" className="form-label">Usuario</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Ingrese su usuario"
                            autoComplete="username"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Contraseña</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Ingrese su contraseña"
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading}
                    >
                        {loading ? 'Iniciando sesión...' : 'Ingresar'}
                    </button>
                </form>

                <div className="login-footer">
                    <p className="text-muted">
                        Single-Company Architecture
                    </p>
                </div>
            </div>
        </div>
    );
}
