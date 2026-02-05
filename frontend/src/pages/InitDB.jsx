import React, { useState, useEffect } from 'react';
import api from '../api';

// Credenciales para acceso a la página de inicialización de base de datos
const INITDB_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

function InitDB() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    nombre: '',
    email: '',
    rol: 'vendedor',
    password: '',
    activo: true
  });
  const [roles] = useState(['admin', 'gerente', 'vendedor']);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  // Verificar autenticación al cargar la página
  useEffect(() => {
    const checkAuth = () => {
      const initDbAuth = localStorage.getItem('initDbAuth');
      if (initDbAuth === 'true') {
        setIsAuthenticated(true);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.username === INITDB_CREDENTIALS.username && 
        loginForm.password === INITDB_CREDENTIALS.password) {
      localStorage.setItem('initDbAuth', 'true');
      setIsAuthenticated(true);
    } else {
      setError('Credenciales inválidas');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('initDbAuth');
    setIsAuthenticated(false);
  };

  const checkDB = async () => {
    try {
      const response = await api.get('/init/check-db');
      setDbStatus(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const initDB = async (withSeeds = true) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/init/init-db', { withSeeds });
      setResult(response.data);
      await checkDB();
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const dropDB = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar toda la base de datos? Esta acción es irreversible y borrará todos los datos.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/init/drop-db');
      setResult(response.data);
      await checkDB();
      setUsers([]);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsers(response.data);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        await api.put(`/usuarios/${editingUser}`, formData);
      } else {
        await api.post('/usuarios', formData);
      }
      
      setShowAddUserModal(false);
      setEditingUser(null);
      setFormData({
        username: '',
        nombre: '',
        email: '',
        rol: 'vendedor',
        password: '',
        activo: true
      });
      await loadUsers();
    } catch (err) {
      console.error('Error al guardar usuario:', err);
      setError(err.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const handleUserEdit = (user) => {
    setEditingUser(user.id);
    setFormData({
      username: user.username,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      password: '',
      activo: user.activo
    });
    setShowAddUserModal(true);
  };

  const handleUserDelete = async (id, username) => {
    if (!window.confirm(`¿Está seguro de eliminar el usuario "${username}"?`)) {
      return;
    }

    try {
      await api.delete(`/usuarios/${id}`);
      await loadUsers();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      setError(err.response?.data?.error || 'Error al eliminar usuario');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/usuarios/${userId}/rol`, { rol: newRole });
      await loadUsers();
    } catch (err) {
      console.error('Error al actualizar rol:', err);
      setError(err.response?.data?.error || 'Error al actualizar rol');
    }
  };

  // Cargar datos solo si está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      checkDB();
      loadUsers();
    }
  }, [isAuthenticated]);

  // Renderizar formulario de login si no está autenticado
  if (!isAuthenticated) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ 
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          padding: '3rem',
          maxWidth: '420px',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ 
              fontSize: '4rem', 
              marginBottom: '1rem', 
              display: 'flex', 
              justifyContent: 'center',
              color: '#667eea'
            }}>
              🐾
            </div>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              color: '#1a202c',
              marginBottom: '0.5rem'
            }}>
              Pet Shop DB
            </h1>
            <p style={{ color: '#718096' }}>
              Gestión de Base de Datos
            </p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="username" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#2d3748'
              }}>
                Usuario
              </label>
              <input
                type="text"
                id="username"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                style={{ 
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  fontFamily: 'Inter, sans-serif'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
                placeholder="Ingrese su usuario"
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#2d3748'
              }}>
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                style={{ 
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  fontFamily: 'Inter, sans-serif'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
                placeholder="Ingrese su contraseña"
              />
            </div>
            
            {error && (
              <div style={{ 
                background: '#fed7d7',
                border: '1px solid #fc8181',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                color: '#c53030',
                fontSize: '0.875rem'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <button type="submit" style={{ 
              width: '100%',
              padding: '0.875rem 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}>
              Acceder
            </button>
          </form>
          
          <div style={{ 
            marginTop: '1.5rem', 
            textAlign: 'center', 
            fontSize: '0.875rem', 
            color: '#718096' 
          }}>
            <small>Credenciales: admin / admin123</small>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar página principal si está autenticado
  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f7fafc',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ 
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: '2rem', marginRight: '1rem' }}>🐾</div>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1a202c',
            margin: 0
          }}>
            Pet Shop - Gestión DB
          </h1>
        </div>
        <button 
          style={{ 
            padding: '0.5rem 1rem',
            background: '#e2e8f0',
            color: '#2d3748',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            fontFamily: 'Inter, sans-serif'
          }}
          onMouseOver={(e) => e.target.style.background = '#cbd5e0'}
          onMouseOut={(e) => e.target.style.background = '#e2e8f0'}
          onClick={handleLogout}
        >
          Cerrar Sesión
        </button>
      </div>

      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '0 2rem'
      }}>
        {/* Estado de la base de datos */}
        <div style={{ 
          background: '#ffffff', 
          padding: '2rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            marginBottom: '1.5rem', 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#1a202c'
          }}>
            Estado Actual
          </h2>
          <button 
            onClick={checkDB}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseOver={(e) => e.target.style.background = '#3182ce'}
            onMouseOut={(e) => e.target.style.background = '#4299e1'}
          >
            Verificar Base de Datos
          </button>
          
          {dbStatus && (
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1.5rem', 
              background: dbStatus.table_count > 0 ? '#c6f6d5' : '#fef5e7',
              color: dbStatus.table_count > 0 ? '#22543d' : '#7c2d12',
              borderRadius: '8px',
              border: `1px solid ${dbStatus.table_count > 0 ? '#9ae6b4' : '#fbd38d'}`
            }}>
              {dbStatus.table_count > 0 ? (
                <div>
                  <strong>✅ Base de datos ya inicializada</strong>
                  <br />
                  Número de tablas: {dbStatus.table_count}
                </div>
              ) : (
                <div>
                  <strong>⚠️ Base de datos vacía</strong>
                  <br />
                  Necesita inicializar la estructura y datos mínimos
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inicialización */}
        <div style={{ 
          background: '#ffffff', 
          padding: '2rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            marginBottom: '1.5rem', 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#1a202c'
          }}>
            Inicialización
          </h2>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button 
              onClick={() => initDB(true)}
              disabled={loading || (dbStatus?.table_count > 0)}
              style={{
                padding: '0.875rem 1.5rem',
                background: loading ? '#a0aec0' : '#48bb78',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseOver={(e) => !loading && (e.target.style.background = '#38a169')}
              onMouseOut={(e) => !loading && (e.target.style.background = '#48bb78')}
            >
              {loading ? 'Inicializando...' : 'Inicializar con Datos de Ejemplo'}
            </button>

            <button 
              onClick={() => initDB(false)}
              disabled={loading || (dbStatus?.table_count > 0)}
              style={{
                padding: '0.875rem 1.5rem',
                background: loading ? '#a0aec0' : '#3182ce',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseOver={(e) => !loading && (e.target.style.background = '#2c5282')}
              onMouseOut={(e) => !loading && (e.target.style.background = '#3182ce')}
            >
              {loading ? 'Inicializando...' : 'Inicializar Base de Datos Mínima'}
            </button>
          </div>


          {dbStatus?.table_count > 0 && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#fef5e7',
              color: '#7c2d12',
              borderRadius: '8px',
              border: '1px solid #fbd38d'
            }}>
              Para inicializar nuevamente, primero debe eliminar la base de datos.
            </div>
          )}
          {result && (
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1.5rem', 
              background: '#c6f6d5',
              color: '#22543d',
              borderRadius: '8px',
              border: '1px solid #9ae6b4'
            }}>
              <strong>✅ {result.message}</strong>
              {result.data && (
                <div style={{ marginTop: '0.5rem' }}>
                  Usuarios creados: {result.data.usuarios}
                  <br />
                  Productos creados: {result.data.productos}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Eliminación */}
        <div style={{ 
          background: '#ffffff', 
          padding: '2rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            marginBottom: '1.5rem', 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#1a202c'
          }}>
            Eliminación
          </h2>
          <button 
            onClick={dropDB}
            disabled={loading}
            style={{
              padding: '0.875rem 1.5rem',
              background: loading ? '#a0aec0' : '#f56565',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseOver={(e) => !loading && (e.target.style.background = '#e53e3e')}
            onMouseOut={(e) => !loading && (e.target.style.background = '#f56565')}
          >
            {loading ? 'Eliminando...' : 'Eliminar Toda la Base de Datos'}
          </button>
          <p style={{ 
            marginTop: '1rem', 
            fontSize: '0.875rem', 
            color: '#718096',
            lineHeight: '1.5'
          }}>
            ⚠️ Esta acción borrará todos los datos y tablas. No se puede deshacer.
          </p>
        </div>

        {/* Gestión de Usuarios */}
        {isAuthenticated && (
          <div style={{ 
            background: '#ffffff', 
            padding: '2rem', 
            borderRadius: '12px', 
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#1a202c',
                margin: 0
              }}>
                Gestión de Usuarios
              </h2>
              <button 
                onClick={() => {
                  setEditingUser(null);
                  setFormData({
                    username: '',
                    nombre: '',
                    email: '',
                    rol: 'vendedor',
                    password: '',
                    activo: true
                  });
                  setShowAddUserModal(true);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => e.target.style.background = '#5568d3'}
                onMouseOut={(e) => e.target.style.background = '#667eea'}
              >
                <span>➕</span> Agregar Usuario
              </button>
            </div>

            {users.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead style={{ 
                    background: '#f7fafc',
                    borderBottom: '2px solid #e2e8f0'
                  }}>
                    <tr>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>ID</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Username</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Nombre</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Email</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Rol</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Activo</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Fecha Creación</th>
                      <th style={{ 
                        padding: '0.75rem 1rem', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#2d3748',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ 
                        borderBottom: '1px solid #e2e8f0',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#f7fafc'}
                      onMouseOut={(e) => e.target.style.background = 'transparent'}>
                        <td style={{ padding: '0.75rem 1rem', color: '#4a5568' }}>
                          {user.id}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4a5568' }}>
                          {user.username}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4a5568' }}>
                          {user.nombre}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4a5568' }}>
                          {user.email || '-'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <select
                            value={user.rol}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              background: 'white',
                              color: '#2d3748',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {roles.map((rol) => (
                              <option key={rol} value={rol}>
                                {rol.charAt(0).toUpperCase() + rol.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ 
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: user.activo ? '#c6f6d5' : '#fed7d7',
                            color: user.activo ? '#22543d' : '#742a2a'
                          }}>
                            {user.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4a5568' }}>
                          {new Date(user.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleUserEdit(user)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: '#4299e1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                fontFamily: 'Inter, sans-serif'
                              }}
                              onMouseOver={(e) => e.target.style.background = '#3182ce'}
                              onMouseOut={(e) => e.target.style.background = '#4299e1'}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleUserDelete(user.id, user.username)}
                              disabled={user.rol === 'admin' && users.filter(u => u.rol === 'admin').length <= 1}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: user.rol === 'admin' && users.filter(u => u.rol === 'admin').length <= 1 ? '#a0aec0' : '#f56565',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: user.rol === 'admin' && users.filter(u => u.rol === 'admin').length <= 1 ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s',
                                fontFamily: 'Inter, sans-serif'
                              }}
                              onMouseOver={(e) => !user.rol === 'admin' && users.filter(u => u.rol === 'admin').length <= 1 && (e.target.style.background = '#e53e3e')}
                              onMouseOut={(e) => !user.rol === 'admin' && users.filter(u => u.rol === 'admin').length <= 1 && (e.target.style.background = '#f56565')}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '3rem',
                background: '#f7fafc',
                borderRadius: '8px'
              }}>
                <div style={{ 
                  fontSize: '4rem', 
                  marginBottom: '1rem',
                  color: '#a0aec0'
                }}>
                  👥
                </div>
                <p style={{ 
                  fontSize: '1.125rem', 
                  color: '#718096',
                  marginBottom: '0.5rem'
                }}>
                  No hay usuarios creados
                </p>
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: '#a0aec0'
                }}>
                  Cree su primer usuario usando el botón "Agregar Usuario"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal para agregar/editar usuario */}
        {showAddUserModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#1a202c',
                  margin: 0
                }}>
                  {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setEditingUser(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#718096',
                    padding: '0.25rem'
                  }}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleUserSubmit}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#2d3748'
                  }}>
                    Username *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    required
                    placeholder="Ingrese el username"
                  />
                </div>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#2d3748'
                  }}>
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    required
                    placeholder="Ingrese el nombre completo"
                  />
                </div>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#2d3748'
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    placeholder="Ingrese el email"
                  />
                </div>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#2d3748'
                  }}>
                    Rol *
                  </label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    required
                  >
                    {roles.map((rol) => (
                      <option key={rol} value={rol}>
                        {rol.charAt(0).toUpperCase() + rol.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#2d3748'
                  }}>
                    {editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña *'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    required={!editingUser}
                    placeholder={editingUser ? 'Nueva contraseña' : 'Ingrese la contraseña'}
                  />
                </div>
                
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontWeight: '600',
                    color: '#2d3748',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      style={{ 
                        width: '1.25rem',
                        height: '1.25rem',
                        cursor: 'pointer'
                      }}
                    />
                    Usuario Activo
                  </label>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '1rem'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setEditingUser(null);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#e2e8f0',
                      color: '#2d3748',
                      border: '1px solid #cbd5e0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#cbd5e0'}
                    onMouseOut={(e) => e.target.style.background = '#e2e8f0'}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#5568d3'}
                    onMouseOut={(e) => e.target.style.background = '#667eea'}
                  >
                    {editingUser ? 'Guardar Cambios' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div style={{ 
            background: '#fed7d7',
            border: '1px solid #fc8181',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem',
            color: '#c53030',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '1.5rem', color: '#fc8181' }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <strong>Error:</strong> {error}
            </div>
            <button 
              onClick={() => setError('')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#c53030',
                padding: '0.25rem'
              }}>
              ×
            </button>
          </div>
        )}

        {/* Información */}
        <div style={{ 
          background: '#f7fafc', 
          padding: '2rem', 
          borderRadius: '12px',
          fontSize: '0.875rem',
          color: '#718096',
          lineHeight: '1.6'
        }}>
          <h3 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            color: '#2d3748',
            marginBottom: '1rem'
          }}>
            Información
          </h3>
          <p>
            Esta página permite gestionar la base de datos del sistema. 
            Puede inicializarla con datos de ejemplo o crear una base de datos vacía.
          </p>
          <p>
            <strong>Inicializar con Datos de Ejemplo:</strong> Crea la estructura de tablas y agrega datos de prueba para probar el sistema.
          </p>
          <p>
            <strong>Inicializar Base de Datos Mínima:</strong> Crea la estructura y los datos m�nimos (admin y configuraci�n b�sica).
          </p>
          <p>
            <strong>Eliminar Toda la Base de Datos:</strong> Borra todas las tablas y datos. Use con extremo cuidado.
          </p>
          {dbStatus?.table_count === 0 && (
            <p>
              Credenciales de prueba (si selecciona inicialización con datos):
              <br />
              Usuario: admin
              <br />
              Contraseña: admin123
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default InitDB;


