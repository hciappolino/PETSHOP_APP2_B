import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function ReporteClienteCC() {
    const [clientes, setClientes] = useState([]);
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [clienteInfo, setClienteInfo] = useState(null);
    const [movimientos, setMovimientos] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState('');
    
    // Date range state
    const [fechaDesde, setFechaDesde] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);

    // Load clients for dropdown
    const loadClientes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/clientes');
            setClientes(response.data);
        } catch (err) {
            setError('Error al cargar clientes: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadClientes();
    }, [loadClientes]);

    // Load CC data when a client is selected
    const loadCCData = useCallback(async () => {
        if (!selectedClienteId) return;
        
        setLoadingData(true);
        setError('');
        try {
            const response = await api.get(`/reportes/cliente-cc/${selectedClienteId}`, {
                params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta }
            });
            setClienteInfo(response.data.cliente);
            setMovimientos(response.data.movimientos);
            setResumen(response.data.resumen);
        } catch (err) {
            setError('Error al cargar estado de cuenta: ' + (err.response?.data?.error || err.message));
            setClienteInfo(null);
            setMovimientos([]);
            setResumen(null);
        } finally {
            setLoadingData(false);
        }
    }, [selectedClienteId, fechaDesde, fechaHasta]);

    useEffect(() => {
        loadCCData();
    }, [loadCCData]);

    const handleClienteChange = (e) => {
        setSelectedClienteId(e.target.value);
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (value) => {
        return parseFloat(value || 0).toFixed(2);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getMovimientoBadge = (tipo) => {
        if (tipo === 'VENTA') {
            return <span className="badge badge-danger">VENTA</span>;
        }
        return <span className="badge badge-success">PAGO</span>;
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Estado de Cuenta Cliente</h1>
                    <p className="text-secondary">Reporte de cuenta corriente por cliente</p>
                </div>
                {clienteInfo && (
                    <button 
                        className="btn btn-outline"
                        onClick={handlePrint}
                        disabled={loadingData}
                    >
                        🖨️ Imprimir
                    </button>
                )}
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            {/* Filters */}
            <div className="card mb-lg">
                <div className="flex gap-md flex-wrap items-end">
                    <div className="flex-1 min-w-[250px]">
                        <label className="form-label">Cliente</label>
                        <select
                            className="form-select"
                            value={selectedClienteId}
                            onChange={handleClienteChange}
                            disabled={loading}
                        >
                            <option value="">-- Seleccionar cliente --</option>
                            {clientes.map(cliente => (
                                <option key={cliente.id} value={cliente.id}>
                                    {cliente.nombre} {cliente.dni_cuit ? `(${cliente.dni_cuit})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="w-[180px]">
                        <label className="form-label">Desde</label>
                        <input
                            type="date"
                            className="form-input"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                        />
                    </div>
                    <div className="w-[180px]">
                        <label className="form-label">Hasta</label>
                        <input
                            type="date"
                            className="form-input"
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loadingData ? (
                <div className="alert alert-info">Cargando datos...</div>
            ) : clienteInfo ? (
                <>
                    {/* Client Info Card */}
                    <div className="card mb-lg">
                        <div className="flex justify-between items-center">
                            <div className="flex gap-lg items-center">
                                <div className="avatar-lg">
                                    <span className="avatar-text">
                                        {clienteInfo.nombre.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="mb-xs">{clienteInfo.nombre}</h3>
                                    <div className="flex gap-md text-sm text-secondary">
                                        <span>📋 {clienteInfo.dni_cuit || '-'}</span>
                                        <span>📞 {clienteInfo.telefono || '-'}</span>
                                        <span>✉️ {clienteInfo.email || '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-secondary">Saldo Actual</div>
                                <div className={`text-2xl font-bold ${parseFloat(clienteInfo.saldo_cc) > 0 ? 'text-danger' : 'text-success'}`}>
                                    ${formatCurrency(clienteInfo.saldo_cc)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    {resumen && (
                        <div className="grid grid-cols-4 gap-md mb-lg">
                            <div className="card p-md text-center">
                                <div className="text-sm text-secondary">Saldo Inicial</div>
                                <div className="text-xl font-bold">${formatCurrency(resumen.saldo_inicial)}</div>
                            </div>
                            <div className="card p-md text-center">
                                <div className="text-sm text-secondary">Total Débitos</div>
                                <div className="text-xl font-bold text-danger">${formatCurrency(resumen.total_debitos)}</div>
                            </div>
                            <div className="card p-md text-center">
                                <div className="text-sm text-secondary">Total Créditos</div>
                                <div className="text-xl font-bold text-success">${formatCurrency(resumen.total_creditos)}</div>
                            </div>
                            <div className="card p-md text-center">
                                <div className="text-sm text-secondary">Saldo Final</div>
                                <div className="text-xl font-bold">${formatCurrency(resumen.saldo_final)}</div>
                            </div>
                        </div>
                    )}

                    {/* Movements Table */}
                    <div className="card">
                        <h3 className="mb-md">Movimientos</h3>
                        {movimientos.length === 0 ? (
                            <div className="alert alert-success">No hay movimientos en el período seleccionado</div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Concepto</th>
                                            <th>Tipo</th>
                                            <th className="text-right">Débito</th>
                                            <th className="text-right">Crédito</th>
                                            <th className="text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movimientos.map((m, index) => (
                                            <tr key={`${m.tipo_movimiento}-${m.id}-${index}`} className="hover:bg-secondary/50">
                                                <td>{formatDate(m.fecha)}</td>
                                                <td>{m.descripcion}</td>
                                                <td>{getMovimientoBadge(m.tipo_movimiento)}</td>
                                                <td className="text-right text-danger">
                                                    {m.debito > 0 ? `$${formatCurrency(m.debito)}` : '-'}
                                                </td>
                                                <td className="text-right text-success">
                                                    {m.credito > 0 ? `$${formatCurrency(m.credito)}` : '-'}
                                                </td>
                                                <td className="text-right font-bold">
                                                    ${formatCurrency(m.saldo)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="card">
                    <div className="text-center text-secondary p-lg">
                        <div className="text-4xl mb-md">👤</div>
                        <p>Seleccione un cliente para ver su estado de cuenta</p>
                    </div>
                </div>
            )}
        </div>
    );
}
