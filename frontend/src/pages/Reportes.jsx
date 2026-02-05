import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Reportes() {
    const [ventasDiarias, setVentasDiarias] = useState([]);
    const [ventasDetalles, setVentasDetalles] = useState([]);
    const [masVendidos, setMasVendidos] = useState([]);
    const [stockBajo, setStockBajo] = useState([]);
    const [ganancias, setGanancias] = useState([]);
    const [gastosMes, setGastosMes] = useState([]);
    const [resumenFinanciero, setResumenFinanciero] = useState({ ventas: 0, mercaderia: 0, insumos: 0, ganancia: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dateRange, setDateRange] = useState('ESTA_SEMANA'); // ESTA_SEMANA, ESTE_MES, ESTE_ANIO, PERSONALIZADO

    const { isAdmin } = useAuth();

    useEffect(() => {
        loadReportes();
    }, [activeTab, dateRange]);

    const getDates = (range) => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        switch (range) {
            case 'ESTA_SEMANA':
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                break;
            case 'ESTE_MES':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'ESTE_ANIO':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                return { since: null, to: null };
        }

        return {
            since: start.toISOString(),
            to: end.toISOString()
        };
    };

    const loadReportes = async () => {
        try {
            setLoading(true);
            const { since, to } = getDates(dateRange);
            const params = { fecha_desde: since, fecha_hasta: to };

            if (activeTab === 'dashboard') {
                const res = await api.get('/reportes/resumen-financiero', { params });
                setResumenFinanciero(res.data);
            } else if (activeTab === 'ventas') {
                const res1 = await api.get('/reportes/ventas-diarias', { params: { dias: 7 } });
                setVentasDiarias(res1.data);
                const res2 = await api.get('/reportes/ventas-del-dia');
                setVentasDetalles(res2.data);
            } else if (activeTab === 'productos') {
                const res = await api.get('/reportes/productos-mas-vendidos', { params: { limite: 10 } });
                setMasVendidos(res.data);
            } else if (activeTab === 'stock') {
                const res = await api.get('/reportes/stock-bajo');
                setStockBajo(res.data);
            } else if (activeTab === 'ganancias' && isAdmin) {
                const res = await api.get('/reportes/ganancias-estimadas');
                setGanancias(res.data);
            } else if (activeTab === 'gastos' && isAdmin) {
                const res = await api.get('/reportes/gastos-del-mes');
                setGastosMes(res.data);
            }
        } catch (error) {
            setError('Error al cargar reportes: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const getMaxVentas = () => {
        if (ventasDiarias.length === 0) return 1;
        return Math.max(...ventasDiarias.map(v => parseFloat(v.total_ventas)));
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Reportes y Estadísticas</h1>
                    <p className="text-secondary">Análisis de rendimiento del negocio</p>
                </div>
                <div className="flex gap-sm">
                    {activeTab === 'dashboard' && (
                        <select
                            className="form-select"
                            style={{ width: '180px' }}
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                        >
                            <option value="ESTA_SEMANA">Esta Semana</option>
                            <option value="ESTE_MES">Este Mes</option>
                            <option value="ESTE_ANIO">Este Año</option>
                        </select>
                    )}
                    <button className="btn btn-outline" onClick={loadReportes}>🔄 Actualizar</button>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            {/* Tabs */}
            <div className="flex gap-sm mb-lg border-bottom pb-sm flex-wrap">
                <button
                    className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    📊 Dashboard Financiero
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'ventas' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('ventas')}
                >
                    📈 Ventas Diarias
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'productos' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('productos')}
                >
                    🏆 Productos
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'stock' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('stock')}
                >
                    ⚠️ Stock Bajo
                </button>
                {isAdmin && (
                    <button
                        className={`btn btn-sm ${activeTab === 'ganancias' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab('ganancias')}
                    >
                        💰 Ganancias
                    </button>
                )}
                {isAdmin && (
                    <button
                        className={`btn btn-sm ${activeTab === 'gastos' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab('gastos')}
                    >
                        🧾 Gastos del Mes
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
            ) : (
                <div className="report-content">
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xl">
                            <div className="card" style={{ borderLeft: '5px solid #10b981' }}>
                                <div className="flex justify-between items-center mb-md">
                                    <span className="text-muted text-sm">TOTAL VENTAS</span>
                                    <span style={{ fontSize: '2rem' }}>💰</span>
                                </div>
                                <h2 className="text-success m-0">${resumenFinanciero.ventas.toLocaleString()}</h2>
                                <p className="text-xs text-muted mt-sm">Total facturado en el periodo</p>
                            </div>

                            <div className="card" style={{ borderLeft: '5px solid #3b82f6' }}>
                                <div className="flex justify-between items-center mb-md">
                                    <span className="text-muted text-sm">COSTO MERCADERÍA</span>
                                    <span style={{ fontSize: '2rem' }}>📦</span>
                                </div>
                                <h2 className="text-primary m-0">${resumenFinanciero.mercaderia.toLocaleString()}</h2>
                                <p className="text-xs text-muted mt-sm">Inversión en productos</p>
                            </div>

                            <div className="card" style={{ borderLeft: '5px solid #06b6d4' }}>
                                <div className="flex justify-between items-center mb-md">
                                    <span className="text-muted text-sm">VALOR STOCK (PRECIO VENTA)</span>
                                    <span style={{ fontSize: '2rem' }}>💲</span>
                                </div>
                                <h2 className="text-primary m-0">${(resumenFinanciero.valor_stock_venta || 0).toLocaleString()}</h2>
                                <p className="text-xs text-muted mt-sm">Valor del inventario a precio de venta (lista predeterminada)</p>
                            </div>

                            <div className="card" style={{ borderLeft: '5px solid #f59e0b' }}>
                                <div className="flex justify-between items-center mb-md">
                                    <span className="text-muted text-sm">GASTOS OPERATIVOS</span>
                                    <span style={{ fontSize: '2rem' }}>📑</span>
                                </div>
                                <h2 className="text-warning m-0">${resumenFinanciero.insumos.toLocaleString()}</h2>
                                <p className="text-xs text-muted mt-sm">Gastos e insumos</p>
                            </div>

                            <div className="card" style={{ borderLeft: '5px solid #8b5cf6' }}>
                                <div className="flex justify-between items-center mb-md">
                                    <span className="text-muted text-sm">GANANCIA ESTIMADA</span>
                                    <span style={{ fontSize: '2rem' }}>🎯</span>
                                </div>
                                <h2 className="text-purple m-0" style={{ color: '#8b5cf6' }}>${resumenFinanciero.ganancia.toLocaleString()}</h2>
                                <p className="text-xs text-muted mt-sm">Ventas - Costos - Gastos</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ventas' && (
                        <>
                            <div className="card mb-lg">
                                <h3>Ventas del Día</h3>
                                <div className="table-container mt-md">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Hora</th>
                                                <th>Cliente</th>
                                                <th>Producto</th>
                                                <th>Cantidad</th>
                                                <th>Total</th>
                                                <th>Tipo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ventasDetalles.length > 0 ? (
                                                ventasDetalles.map((v, i) => (
                                                    <tr key={i}>
                                                        <td className="text-xs">{new Date(v.fecha).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td>{v.cliente_nombre || 'Anónimo'}</td>
                                                        <td className="text-sm">
                                                            <div>{v.producto_nombre}</div>
                                                            <div className="text-xs text-muted">
                                                                {v.producto_fabricante ? v.producto_fabricante : ''}{v.producto_marca ? (v.producto_fabricante ? ' • ' : '') + v.producto_marca : ''}
                                                            </div>
                                                        </td>
                                                        <td className="text-center font-bold">{v.cantidad}</td>
                                                        <td className="font-bold text-success">${parseFloat(v.subtotal).toFixed(2)}</td>
                                                        <td><span className={`badge ${v.tipo_venta === 'CONTADO' ? 'badge-success' : 'badge-info'}`}>{v.tipo_venta}</span></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan="6" className="text-center text-muted p-lg">Sin ventas registradas hoy</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="card">
                                <h3>Historial de Ventas (7 días)</h3>
                                <div className="flex items-end gap-md mt-xl" style={{ height: '300px', paddingBottom: '30px' }}>
                                    {[...ventasDiarias].reverse().map((v, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-sm">
                                            <div
                                                className="bg-primary hover:bg-primary-dark transition-all rounded-t-md w-full"
                                                style={{
                                                    height: `${(parseFloat(v.total_ventas) / getMaxVentas() * 250)}px`,
                                                    minHeight: '5px'
                                                }}
                                                title={`$${v.total_ventas}`}
                                            ></div>
                                            <span className="text-xs text-muted rotate-45 mt-sm whitespace-nowrap">
                                                {new Date(v.fecha).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                            </span>
                                            <strong className="text-xs">${Math.round(v.total_ventas)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'productos' && (
                        <div className="card">
                            <h3>Top 10 Productos Más Vendidos</h3>
                            <div className="table-container mt-md">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Cantidad</th>
                                            <th>Veces</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {masVendidos.map((p, i) => (
                                            <tr key={i}>
                                                <td>{p.nombre}</td>
                                                <td className="font-bold">{p.total_vendido}</td>
                                                <td className="text-muted">{p.veces_vendido}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'stock' && (
                        <div className="card">
                            <h3>Alertas de Reposición Urgente</h3>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Stock Actual</th>
                                            <th>Stock Mínimo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockBajo.map((p, i) => (
                                            <tr key={i}>
                                                <td><strong>{p.nombre}</strong></td>
                                                <td className="text-danger font-bold">{p.stock_actual}</td>
                                                <td>{p.stock_minimo}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ganancias' && isAdmin && (
                        <div className="card">
                            <h3>Estimación de Ganancias</h3>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Venta</th>
                                            <th>Costo Est.</th>
                                            <th>Ganancia Est.</th>
                                            <th>Margen %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ganancias.map((g, i) => (
                                            <tr key={i}>
                                                <td>{new Date(g.fecha).toLocaleDateString()}</td>
                                                <td>${parseFloat(g.venta_total).toFixed(2)}</td>
                                                <td className="text-muted">${parseFloat(g.costo_total_estimado).toFixed(2)}</td>
                                                <td className="text-success font-bold">${parseFloat(g.ganancia_estimada).toFixed(2)}</td>
                                                <td>{((g.ganancia_estimada / g.venta_total) * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'gastos' && isAdmin && (
                        <div className="card">
                            <h3>Gastos del Mes (Servicios / Insumos)</h3>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gastosMes.length > 0 ? (
                                            gastosMes.map((g, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(g.fecha).toLocaleDateString()}</td>
                                                    <td className="font-bold text-danger">${parseFloat(g.total_gastos).toFixed(2)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="2" className="text-center text-muted p-lg">Sin gastos registrados este mes</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
