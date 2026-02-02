import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function InspeccionGranel() {
    const [reportes, setReportes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filtroProducto, setFiltroProducto] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos', 'abierta', 'cerrada'
    const [productos, setProductos] = useState([]);
    const [expandido, setExpandido] = useState(null); // ID del reporte expandido
    const { isAdmin, isGerente } = useAuth();

    useEffect(() => {
        loadReporte();
        loadProductos();
    }, []);

    const loadReporte = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await api.get('/reportes/rendimiento-granel');
            
            // Convertir strings a números
            const reportesConvertidos = (response.data || []).map(reporte => ({
                ...reporte,
                kilos_teoricos: parseFloat(reporte.kilos_teoricos) || 0,
                kilos_vendidos_reales: parseFloat(reporte.kilos_vendidos_reales) || 0,
                diferencia_kilos: parseFloat(reporte.diferencia_kilos) || 0,
                detalle_ventas: (reporte.detalle_ventas || []).map(venta => ({
                    ...venta,
                    cantidad: parseFloat(venta.cantidad) || 0
                }))
            }));
            
            setReportes(reportesConvertidos);
        } catch (err) {
            console.error('Error al cargar:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Error desconocido';
            setError('Error al cargar inspección: ' + errorMsg);
            setReportes([]);
        } finally {
            setLoading(false);
        }
    };

    const loadProductos = async () => {
        try {
            const response = await api.get('/productos', { params: { activo: 'true' } });
            const productosGranel = (response.data || []).filter(p => p.tipo_presentacion === 'BOLSA');
            setProductos(productosGranel);
        } catch (err) {
            console.error('Error cargando productos:', err);
            setProductos([]);
        }
    };

    // Filtros aplicados
    let reportesFiltrados = reportes;
    
    if (filtroProducto) {
        reportesFiltrados = reportesFiltrados.filter(r => r.producto_id.toString() === filtroProducto);
    }
    
    if (filtroEstado === 'abierta') {
        reportesFiltrados = reportesFiltrados.filter(r => !r.fecha_fin);
    } else if (filtroEstado === 'cerrada') {
        reportesFiltrados = reportesFiltrados.filter(r => r.fecha_fin);
    }

    const tieneAlerta = (diferencia) => {
        const diff = parseFloat(diferencia) || 0;
        return Math.abs(diff) > 0.05;
    };

    const toggleExpandir = (index) => {
        setExpandido(expandido === index ? null : index);
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            {/* NAVEGACIÓN */}
            <div style={{ 
                marginBottom: '2rem', 
                paddingBottom: '1rem', 
                borderBottom: '2px solid var(--border)',
                display: 'flex',
                gap: '1.5rem'
            }}>
                <Link to="/proveedores" style={{ 
                    color: 'var(--text-secondary)', 
                    textDecoration: 'none',
                    fontSize: '1.125rem',
                    fontWeight: 600
                }}>
                    🏢 Proveedores
                </Link>
                <Link to="/compras" style={{ 
                    color: 'var(--text-secondary)', 
                    textDecoration: 'none',
                    fontSize: '1.125rem',
                    fontWeight: 600
                }}>
                    📋 Compras
                </Link>
            </div>

            {/* HEADER */}
            <div className="mb-lg">
                <h1>🔍 Inspección de Bolsas a Granel</h1>
                <p className="text-secondary">
                    Listado completo de apertura y control de bolsas. Click en una fila para ver detalles.
                </p>
            </div>

            {error && (
                <div className="alert alert-danger mb-md" style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--danger)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem'
                }}>
                    {error}
                </div>
            )}

            {/* FILTROS */}
            <div className="card mb-lg" style={{ padding: '1rem' }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem'
                }}>
                    <div>
                        <label className="form-label">Filtrar por Producto</label>
                        <select
                            className="form-select"
                            value={filtroProducto}
                            onChange={(e) => setFiltroProducto(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <option value="">Todos los productos</option>
                            {productos.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="form-label">Filtrar por Estado</label>
                        <select
                            className="form-select"
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <option value="todos">Todas</option>
                            <option value="abierta">🟢 Abiertas</option>
                            <option value="cerrada">⊘ Cerradas</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* CONTENIDO */}
            {loading ? (
                <div className="text-center" style={{ padding: '3rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando datos...</p>
                </div>
            ) : reportesFiltrados.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔭</div>
                    <h3>Sin datos de inspección</h3>
                    <p className="text-secondary">
                        {reportes.length === 0 
                            ? 'No se han abierto bolsas a granel todavía.'
                            : 'No hay resultados con los filtros aplicados.'}
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                        Total de bolsas registradas: <strong>{reportes.length}</strong>
                    </p>
                </div>
            ) : (
                <>
                    {/* RESUMEN */}
                    <div style={{ 
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span className="text-secondary">
                            Mostrando <strong>{reportesFiltrados.length}</strong> de <strong>{reportes.length}</strong> bolsas
                        </span>
                        <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                            Click en una fila para ver detalles
                        </span>
                    </div>

                    {/* TABLA COMPACTA */}
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}></th>
                                    <th>Producto</th>
                                    <th>Fecha Apertura</th>
                                    <th>Usuario</th>
                                    <th style={{ textAlign: 'right' }}>Teórico</th>
                                    <th style={{ textAlign: 'right' }}>Real</th>
                                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                                    <th style={{ textAlign: 'center' }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportesFiltrados.map((reporte, idx) => {
                                    const diferencia = reporte.diferencia_kilos;
                                    const alerta = tieneAlerta(diferencia);
                                    const estaExpandido = expandido === idx;
                                    
                                    return (
                                        <>
                                            <tr 
                                                key={idx}
                                                onClick={() => toggleExpandir(idx)}
                                                style={{
                                                    cursor: 'pointer',
                                                    backgroundColor: estaExpandido ? 'rgba(99, 102, 241, 0.1)' : undefined,
                                                    transition: 'background-color 0.2s'
                                                }}
                                            >
                                                <td style={{ textAlign: 'center' }}>
                                                    {alerta && <span style={{ fontSize: '1.2rem' }}>⚠️</span>}
                                                </td>
                                                <td>
                                                    <strong>{reporte.producto_nombre}</strong>
                                                </td>
                                                <td style={{ fontSize: '0.875rem' }}>
                                                    {new Date(reporte.fecha_inicio).toLocaleDateString()} {' '}
                                                    {new Date(reporte.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ fontSize: '0.875rem' }}>
                                                    {reporte.usuario_nombre}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                    {reporte.kilos_teoricos.toFixed(2)} kg
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                                                    {reporte.kilos_vendidos_reales.toFixed(2)} kg
                                                </td>
                                                <td style={{ 
                                                    textAlign: 'right', 
                                                    fontWeight: 700,
                                                    color: alerta ? 'var(--danger)' : 'var(--success)'
                                                }}>
                                                    {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} kg
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {!reporte.fecha_fin ? (
                                                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                                            🟢 Abierta
                                                        </span>
                                                    ) : (
                                                        <span className="badge" style={{
                                                            fontSize: '0.7rem',
                                                            backgroundColor: 'rgba(148, 163, 184, 0.2)',
                                                            color: 'var(--text-muted)'
                                                        }}>
                                                            ⊘ Cerrada
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            
                                            {/* FILA EXPANDIDA CON DETALLES */}
                                            {estaExpandido && (
                                                <tr>
                                                    <td colSpan="8" style={{ 
                                                        padding: '1.5rem',
                                                        backgroundColor: 'var(--bg-tertiary)'
                                                    }}>
                                                        <div style={{ 
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                                            gap: '1.5rem'
                                                        }}>
                                                            {/* INFO GENERAL */}
                                                            <div>
                                                                <h5 style={{ marginTop: 0, marginBottom: '1rem' }}>
                                                                    📊 Información General
                                                                </h5>
                                                                <div style={{ fontSize: '0.875rem', lineHeight: 1.8 }}>
                                                                    <p style={{ margin: '0.25rem 0' }}>
                                                                        <strong>Producto:</strong> {reporte.producto_nombre}
                                                                    </p>
                                                                    <p style={{ margin: '0.25rem 0' }}>
                                                                        <strong>Abierta por:</strong> {reporte.usuario_nombre}
                                                                    </p>
                                                                    <p style={{ margin: '0.25rem 0' }}>
                                                                        <strong>Fecha apertura:</strong> {new Date(reporte.fecha_inicio).toLocaleString()}
                                                                    </p>
                                                                    {reporte.fecha_fin && (
                                                                        <p style={{ margin: '0.25rem 0' }}>
                                                                            <strong>Fecha cierre:</strong> {new Date(reporte.fecha_fin).toLocaleString()}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* ANÁLISIS */}
                                                                <div style={{ 
                                                                    marginTop: '1rem',
                                                                    padding: '1rem',
                                                                    backgroundColor: alerta 
                                                                        ? 'rgba(239, 68, 68, 0.1)' 
                                                                        : 'rgba(16, 185, 129, 0.1)',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    borderLeft: `4px solid ${alerta ? 'var(--danger)' : 'var(--success)'}`
                                                                }}>
                                                                    <p style={{ 
                                                                        margin: 0,
                                                                        fontWeight: 600,
                                                                        color: alerta ? 'var(--danger)' : 'var(--success)'
                                                                    }}>
                                                                        {alerta 
                                                                            ? `⚠️ Diferencia de ${Math.abs(diferencia).toFixed(3)} kg detectada` 
                                                                            : `✓ Diferencia mínima: ${diferencia.toFixed(3)} kg`
                                                                        }
                                                                    </p>
                                                                    <p style={{ 
                                                                        margin: '0.5rem 0 0 0',
                                                                        fontSize: '0.875rem',
                                                                        color: 'var(--text-secondary)'
                                                                    }}>
                                                                        {alerta 
                                                                            ? 'Se recomienda revisar este registro.' 
                                                                            : 'El registro está dentro de parámetros normales.'
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* DETALLE DE VENTAS */}
                                                            {reporte.detalle_ventas && reporte.detalle_ventas.length > 0 && (
                                                                <div>
                                                                    <h5 style={{ marginTop: 0, marginBottom: '1rem' }}>
                                                                        📋 Detalle de Ventas ({reporte.detalle_ventas.length})
                                                                    </h5>
                                                                    <div style={{ 
                                                                        maxHeight: '250px',
                                                                        overflowY: 'auto',
                                                                        border: '1px solid var(--border)',
                                                                        borderRadius: 'var(--radius-md)'
                                                                    }}>
                                                                        <table style={{ 
                                                                            width: '100%',
                                                                            fontSize: '0.875rem'
                                                                        }}>
                                                                            <thead style={{ 
                                                                                position: 'sticky',
                                                                                top: 0,
                                                                                backgroundColor: 'var(--bg-secondary)'
                                                                            }}>
                                                                                <tr>
                                                                                    <th style={{ 
                                                                                        padding: '0.5rem',
                                                                                        textAlign: 'left',
                                                                                        borderBottom: '1px solid var(--border)'
                                                                                    }}>
                                                                                        Fecha
                                                                                    </th>
                                                                                    <th style={{ 
                                                                                        padding: '0.5rem',
                                                                                        textAlign: 'right',
                                                                                        borderBottom: '1px solid var(--border)'
                                                                                    }}>
                                                                                        Cantidad
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {reporte.detalle_ventas.map((venta, vidx) => (
                                                                                    <tr key={vidx}>
                                                                                        <td style={{ padding: '0.5rem' }}>
                                                                                            {new Date(venta.fecha).toLocaleString()}
                                                                                        </td>
                                                                                        <td style={{ 
                                                                                            padding: '0.5rem',
                                                                                            textAlign: 'right',
                                                                                            fontWeight: 600
                                                                                        }}>
                                                                                            {venta.cantidad.toFixed(2)} kg
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
