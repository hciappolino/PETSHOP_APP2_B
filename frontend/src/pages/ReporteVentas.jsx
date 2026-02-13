import { useState, useEffect } from 'react';
import api from '../api';

const formatCurrency = (amount) => {
    const num = Math.round(parseFloat(amount) || 0);
    return '$' + num.toLocaleString('es-AR');
};

export default function ReporteVentas() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filters
    const [periodo, setPeriodo] = useState('mes');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [activeTab, setActiveTab] = useState('resumen');

    useEffect(() => {
        loadData();
    }, [periodo, fechaDesde, fechaHasta]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');
            
            const params = { periodo };
            if (periodo === 'personalizado') {
                if (fechaDesde) params.fecha_desde = fechaDesde;
                if (fechaHasta) params.fecha_hasta = fechaHasta;
            }
            
            const response = await api.get('/reportes/ventas', { params });
            setData(response.data);
        } catch (err) {
            setError('Error al cargar el reporte: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTipoVentaBadge = (tipo) => {
        const badges = {
            'CONTADO': { class: 'badge-success', text: 'Contado' },
            'CUENTA_CORRIENTE': { class: 'badge-warning', text: 'CC' }
        };
        return badges[tipo] || { class: 'badge-secondary', text: tipo };
    };

    const handleExport = () => {
        if (!data) return;
        
        const exportData = {
            periodo: data.periodo,
            resumen: data.resumen,
            ventas_por_tipo: data.ventas_por_tipo,
            productos_top: data.productos_top
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-ventas-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Set default dates when switching to personalizado
    const handlePeriodoChange = (newPeriodo) => {
        setPeriodo(newPeriodo);
        if (newPeriodo === 'personalizado') {
            const today = new Date();
            const lastMonth = new Date(today);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            setFechaDesde(lastMonth.toISOString().split('T')[0]);
            setFechaHasta(today.toISOString().split('T')[0]);
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Reporte de Ventas</h1>
                    <p className="text-secondary">Análisis detallado de ventas del período</p>
                </div>
                <div className="flex gap-sm">
                    <select
                        className="form-select"
                        style={{ width: '150px' }}
                        value={periodo}
                        onChange={(e) => handlePeriodoChange(e.target.value)}
                    >
                        <option value="dia">Hoy</option>
                        <option value="semana">Esta Semana</option>
                        <option value="mes">Este Mes</option>
                        <option value="personalizado">Personalizado</option>
                    </select>
                    {periodo === 'personalizado' && (
                        <>
                            <input
                                type="date"
                                className="form-input"
                                style={{ width: '150px' }}
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                            />
                            <input
                                type="date"
                                className="form-input"
                                style={{ width: '150px' }}
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                            />
                        </>
                    )}
                    <button className="btn btn-outline" onClick={loadData}>🔄 Actualizar</button>
                    {data && (
                        <button className="btn btn-outline" onClick={handleExport}>📥 Exportar</button>
                    )}
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            {/* Tabs */}
            <div className="flex gap-sm mb-lg border-bottom pb-sm flex-wrap">
                <button
                    className={`btn btn-sm ${activeTab === 'resumen' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('resumen')}
                >
                    📊 Resumen
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'detalles' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('detalles')}
                >
                    📋 Detalles
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'productos' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('productos')}
                >
                    🏆 Productos
                </button>
            </div>

            {loading ? (
                <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
            ) : data ? (
                <div className="report-content">
                    {/* Resumen Tab */}
                    {activeTab === 'resumen' && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xl">
                                <div className="card" style={{ borderLeft: '5px solid #10b981' }}>
                                    <div className="flex justify-between items-center mb-md">
                                        <span className="text-muted text-sm">TOTAL VENTAS</span>
                                        <span style={{ fontSize: '2rem' }}>💰</span>
                                    </div>
                                    <h2 className="text-success m-0">{formatCurrency(data.resumen.total_ventas)}</h2>
                                    <p className="text-xs text-muted mt-sm">Monto total de ventas</p>
                                </div>

                                <div className="card" style={{ borderLeft: '5px solid #3b82f6' }}>
                                    <div className="flex justify-between items-center mb-md">
                                        <span className="text-muted text-sm">TRANSACCIONES</span>
                                        <span style={{ fontSize: '2rem' }}>📝</span>
                                    </div>
                                    <h2 className="text-primary m-0">{data.resumen.numero_ventas}</h2>
                                    <p className="text-xs text-muted mt-sm">Número de ventas</p>
                                </div>

                                <div className="card" style={{ borderLeft: '5px solid #8b5cf6' }}>
                                    <div className="flex justify-between items-center mb-md">
                                        <span className="text-muted text-sm">TICKET PROMEDIO</span>
                                        <span style={{ fontSize: '2rem' }}>📈</span>
                                    </div>
                                    <h2 className="text-purple m-0">{formatCurrency(data.resumen.ticket_promedio)}</h2>
                                    <p className="text-xs text-muted mt-sm">Venta promedio por transacción</p>
                                </div>

                                <div className="card" style={{ borderLeft: '5px solid #f59e0b' }}>
                                    <div className="flex justify-between items-center mb-md">
                                        <span className="text-muted text-sm">PERÍODO</span>
                                        <span style={{ fontSize: '2rem' }}>📅</span>
                                    </div>
                                    <h2 className="text-warning m-0" style={{ fontSize: '1.2rem' }}>
                                        {formatDate(data.periodo.desde)} - {formatDate(data.periodo.hasta)}
                                    </h2>
                                    <p className="text-xs text-muted mt-sm">Rango de fechas</p>
                                </div>
                            </div>

                            {/* Sales by Type */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-xl">
                                <div className="card">
                                    <h3>Ventas por Tipo</h3>
                                    <div className="table-container mt-md">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Tipo</th>
                                                    <th>Ventas</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(data.ventas_por_tipo).map(([tipo, stats]) => {
                                                    const badge = getTipoVentaBadge(tipo);
                                                    return (
                                                        <tr key={tipo}>
                                                            <td>
                                                                <span className={`badge ${badge.class}`}>{badge.text}</span>
                                                            </td>
                                                            <td className="font-bold">{stats.numero_ventas}</td>
                                                            <td className="font-bold text-success">{formatCurrency(stats.total_ventas)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="card">
                                    <h3>Ventas por Día</h3>
                                    <div className="table-container mt-md">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Ventas</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.ventas_por_dia.slice(0, 10).map((row, i) => (
                                                    <tr key={i}>
                                                        <td>{formatDate(row.fecha)}</td>
                                                        <td className="font-bold">{row.numero_ventas}</td>
                                                        <td className="text-success">{formatCurrency(row.total_ventas)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Detalles Tab */}
                    {activeTab === 'detalles' && (
                        <div className="card">
                            <h3>Detalle de Ventas</h3>
                            <div className="table-container mt-md">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Fecha/Hora</th>
                                            <th>Cliente</th>
                                            <th>Tipo</th>
                                            <th>Total</th>
                                            <th>Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.ventas_detalles.length > 0 ? (
                                            data.ventas_detalles.map((venta) => {
                                                const badge = getTipoVentaBadge(venta.tipo_venta);
                                                return (
                                                    <tr key={venta.venta_id}>
                                                        <td>#{venta.venta_id}</td>
                                                        <td>{formatDateTime(venta.fecha)}</td>
                                                        <td>{venta.cliente_nombre || 'Mostrador'}</td>
                                                        <td>
                                                            <span className={`badge ${badge.class}`}>{badge.text}</span>
                                                        </td>
                                                        <td className="font-bold text-success">{formatCurrency(venta.total)}</td>
                                                        <td>{venta.usuario_nombre}</td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="6" className="text-center text-muted p-lg">
                                                    No hay ventas en este período
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Productos Tab */}
                    {activeTab === 'productos' && (
                        <div className="card">
                            <h3>Top 20 Productos Más Vendidos</h3>
                            <div className="table-container mt-md">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Producto</th>
                                            <th>Código</th>
                                            <th>Cantidad</th>
                                            <th>Ventas</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.productos_top.map((producto, index) => (
                                            <tr key={producto.producto_id}>
                                                <td className="text-muted">{index + 1}</td>
                                                <td className="font-bold">{producto.producto_nombre}</td>
                                                <td className="text-muted">{producto.producto_codigo}</td>
                                                <td className="text-center">
                                                    <span className="badge badge-info">{producto.cantidad_vendida}</span>
                                                </td>
                                                <td className="text-muted">{producto.numero_ventas}</td>
                                                <td className="font-bold text-success">{formatCurrency(producto.total_ventas)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card">
                    <div className="text-center p-xl text-muted">
                        No hay datos disponibles para el período seleccionado
                    </div>
                </div>
            )}

            <style>{`
                .grid.grid-cols-1.md\:grid-cols-4 {
                    display: grid;
                    gap: 1.5rem;
                }
                
                @media (min-width: 768px) {
                    .grid.grid-cols-1.md\:grid-cols-4 {
                        grid-template-columns: repeat(4, 1fr);
                    }
                }
                
                .grid.grid-cols-1.md\:grid-cols-2 {
                    display: grid;
                    gap: 1.5rem;
                }
                
                @media (min-width: 768px) {
                    .grid.grid-cols-1.md\:grid-cols-2 {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                
                .text-purple {
                    color: #8b5cf6;
                }
                
                .badge-info {
                    background: #06b6d4;
                    color: white;
                }
            `}</style>
        </div>
    );
}
