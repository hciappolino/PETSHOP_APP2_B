import React, { useState } from 'react';
import axios from 'axios';

function InitDB() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);

  const checkDB = async () => {
    try {
      const response = await axios.get('/api/init/check-db');
      setDbStatus(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const initDB = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/init/init-db');
      setResult(response.data);
      await checkDB();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: '2rem', 
        color: '#333' 
      }}>
        Inicialización de Base de Datos
      </h1>

      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>Estado Actual</h2>
        <button 
          onClick={checkDB}
          style={{
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Verificar Base de Datos
        </button>
        {dbStatus && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: dbStatus.table_count > 0 ? '#d4edda' : '#fff3cd',
            color: dbStatus.table_count > 0 ? '#155724' : '#856404',
            borderRadius: '4px',
            border: `1px solid ${dbStatus.table_count > 0 ? '#c3e6cb' : '#ffeeba'}`
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
                Necesita inicializar la estructura y datos
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>Inicialización</h2>
        <button 
          onClick={initDB}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            background: loading ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            marginRight: '1rem'
          }}
        >
          {loading ? 'Inicializando...' : 'Inicializar Base de Datos'}
        </button>
        {result && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            border: '1px solid #c3e6cb'
          }}>
            <strong>✅ {result.message}</strong>
            <br />
            Usuarios creados: {result.data.usuarios}
            <br />
            Productos creados: {result.data.productos}
          </div>
        )}
      </div>

      {error && (
        <div style={{ 
          padding: '1rem', 
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      <div style={{ 
        background: '#e9ecef', 
        padding: '1rem', 
        borderRadius: '8px',
        fontSize: '0.9rem',
        color: '#666'
      }}>
        <h3>Información</h3>
        <p>
          Esta página permite inicializar la base de datos del sistema. 
          Se creará la estructura de tablas y se insertarán datos de ejemplo.
        </p>
        <p>
          Credenciales de prueba:
          <br />
          Email: admin@petshop.com
          <br />
          Contraseña: admin123
        </p>
      </div>
    </div>
  );
}

export default InitDB;
