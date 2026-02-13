import { useState, useEffect } from 'react';
import api from '../api';

const formatCurrency = (amount) => {
    const num = Math.round(parseFloat(amount) || 0);
    return '$' + num.toLocaleString('es-AR');
};

export default function ReporteCajaDiaria() {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadData();
    }, [fecha]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/reportes/caja/diaria?fecha=${fecha}`);
            setData(response.data);
        } catch (error) {
            console.error('Error loading data:', error);
            setError('Error al cargar datos del reporte');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-AR');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-AR');
    };

    const getStatusBadge = (estado) => {
        if (!estado) return <span className="badge badge-secondary">SIN SESIÓN</span>;
        if (estado === 'ABIERTA') return <span className="badge badge-success">ABIERTA</span>;
        return <span className="badge badge-danger">CERRADA</span>;
    };

    const getMotivoLabel = (motivo) => {
        // Handle both motivo_id (numeric) and motivo (string) formats
        const labels = {
            // Numeric IDs from fondos_motivos table
            1: 'VENTA',
            2: 'COMPRA',
            3: 'GASTO',
            4: 'DEPOSITO',
            5: 'RETIRO',
            6: 'AJUSTE',
            7: 'APERTURA_CAJA',
            8: 'CIERRE_CAJA',
            9: 'AJUSTE_CAJA',
            // String labels
            'APERTURA_CAJA': 'Apertura de Caja',
            'CIERRE_CAJA': 'Cierre de Caja',
            'VENTA': 'Venta',
            'VENTA_CONTADO': 'Venta Contado',
            'DEPOSITO': 'Depósito',
            'RETIRO': 'Retiro',
            'GASTO': 'Gasto',
            'AJUSTE': 'Ajuste',
            'AJUSTE_CAJA': 'Ajuste de Caja',
            'TRANSFERENCIA': 'Transferencia',
            'COMPRA': 'Compra'
        };
        
        // If motivo is numeric, convert to string label first
        const motivoStr = motivo !== undefined && motivo !== null ? String(motivo) : '';
        const stringLabel = labels[motivoStr] || labels[parseInt(motivo)] || motivoStr;
        
        // Return the human-readable label
        return labels[stringLabel] || stringLabel;
    };

    if (loading) {
        return (
            <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                <p className="mt-md">Cargando reporte...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container" style={{ padding: '2rem' }}>
                <div className="alert alert-danger">{error}</div>
                <button className="btn btn-primary mt-md" onClick={loadData}>Reintentar</button>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Reporte Caja Diaria</h1>
                    <p className="text-secondary">Resumen de movimientos de caja</p>
                </div>
                <button className="btn btn-outline" onClick={handlePrint}>
                    🖨️ Imprimir
                </button>
            </div>

            {/* Date Picker */}
            <div className="card mb-lg no-print">
                <div className="flex items-center gap-md">
                    <label className="form-label m-0">Fecha:</label>
                    <input
                        type="date"
                        className="form-input"
                        style={{ maxWidth: '200px' }}
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                    />
                    <span className="text-muted">
                        {formatDate(fecha)}
                    </span>
                </div>
            </div>

            {/* Warning if no session */}
            {data?.advertencia && (
                <div className="alert alert-warning mb-lg">
                    ⚠️ {data.advertencia}
                </div>
            )}

            {data?.sesion && (
                <>
                    {/* Session Status */}
                    <div className="card mb-lg">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="m-0">Sesión de Caja</h3>
                                <p className="text-muted m-0">
                                    {formatDateTime(data.sesion.apertura_fecha)}
                                    {data.sesion.cierre_fecha && ` - ${formatDateTime(data.sesion.cierre_fecha)}`}
                                </p>
                            </div>
                            {getStatusBadge(data.sesion.estado)}
                        </div>
                        <div className="flex gap-lg mt-md">
                            <div>
                                <span className="text-muted">Usuario Apertura:</span>
                                <span className="ml-sm">{data.sesion.usuario_apertura_nombre || '-'}</span>
                            </div>
                            {data.sesion.usuario_cierre_nombre && (
                                <div>
                                    <span className="text-muted">Usuario Cierre:</span>
                                    <span className="ml-sm">{data.sesion.usuario_cierre_nombre}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md mb-lg">
                        <div className="card">
                            <div className="text-muted text-sm">Saldo Apertura</div>
                            <div className="font-bold text-lg">{formatCurrency(data.resumen.saldo_apertura)}</div>
                        </div>
                        <div className="card">
                            <div className="text-muted text-sm">Total Ingresos</div>
                            <div className="font-bold text-lg text-success">{formatCurrency(data.resumen.total_ingresos)}</div>
                        </div>
                        <div className="card">
                            <div className="text-muted text-sm">Total Egresos</div>
                            <div className="font-bold text-lg text-danger">{formatCurrency(data.resumen.total_egresos)}</div>
                        </div>
                        <div className="card">
                            <div className="text-muted text-sm">Saldo Esperado</div>
                            <div className="font-bold text-lg text-primary">{formatCurrency(data.resumen.saldo_cierre_esperado)}</div>
                        </div>
                        <div className="card">
                            <div className="text-muted text-sm">Saldo Real</div>
                            <div className="font-bold text-lg">
                                {data.resumen.saldo_cierre_real !== null 
                                    ? formatCurrency(data.resumen.saldo_cierre_real)
                                    : '-'}
                            </div>
                        </div>
                        <div className="card">
                            <div className="text-muted text-sm">Diferencia</div>
                            <div className={`font-bold text-lg ${data.resumen.diferencia === 0 ? 'text-success' : data.resumen.diferencia > 0 ? 'text-success' : 'text-danger'}`}>
                                {data.resumen.diferencia !== null 
                                    ? formatCurrency(data.resumen.diferencia)
                                    : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Balance Calculation Details */}
                    <div className="card mb-lg">
                        <h4 className="mb-md">Detalle de Cálculo</h4>
                        <div className="flex flex-col gap-sm">
                            <div className="flex justify-between">
                                <span>Saldo Apertura</span>
                                <span>{formatCurrency(data.resumen.saldo_apertura)}</span>
                            </div>
                            <div className="flex justify-between text-success">
                                <span>+ Ingresos</span>
                                <span>{formatCurrency(data.resumen.total_ingresos)}</span>
                            </div>
                            <div className="flex justify-between text-danger">
                                <span>- Egresos</span>
                                <span>{formatCurrency(data.resumen.total_egresos)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-sm font-bold">
                                <span>= Saldo Esperado</span>
                                <span>{formatCurrency(data.resumen.saldo_cierre_esperado)}</span>
                            </div>
                            {data.resumen.saldo_cierre_real !== null && (
                                <>
                                    <div className="flex justify-between border-t pt-sm">
                                        <span>Saldo Real (contado)</span>
                                        <span>{formatCurrency(data.resumen.saldo_cierre_real)}</span>
                                    </div>
                                    <div className={`flex justify-between font-bold ${data.resumen.diferencia === 0 ? 'text-success' : data.resumen.diferencia > 0 ? 'text-success' : 'text-danger'}`}>
                                        <span>Diferencia</span>
                                        <span>{formatCurrency(data.resumen.diferencia)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Movements Table */}
                    <div className="card">
                        <h4 className="mb-md">Movimientos de Fondos</h4>
                        {data.movimientos.length === 0 ? (
                            <p className="text-muted">No hay movimientos registrados</p>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fecha/Hora</th>
                                            <th>Tipo</th>
                                            <th>Motivo</th>
                                            <th>Descripción</th>
                                            <th>Monto</th>
                                            <th>Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.movimientos.map((m) => (
                                            <tr key={m.id}>
                                                <td>{formatDateTime(m.fecha)}</td>
                                                <td>
                                                    <span className={`badge ${m.tipo === 'INGRESO' ? 'badge-success' : 'badge-danger'}`}>
                                                        {m.tipo}
                                                    </span>
                                                </td>
                                                <td>{getMotivoLabel(m.motivo)}</td>
                                                <td>{m.descripcion || '-'}</td>
                                                <td className={m.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}>
                                                    {m.tipo === 'INGRESO' ? '+' : '-'}{formatCurrency(m.monto)}
                                                </td>
                                                <td>{formatCurrency(m.saldo_nuevo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Print Footer */}
            <div className="print-footer mt-xl text-center text-muted text-sm" style={{ display: 'none' }}>
                <p>Pet Shop - Reporte de Caja Diaria</p>
                <p>Generado el {new Date().toLocaleString()}</p>
            </div>

            <style>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    .print-footer {
                        display: block !important;
                    }
                    .container {
                        padding: 0 !important;
                    }
                    .card {
                        box-shadow: none !important;
                        border: 1px solid #ddd !important;
                    }
                }
            `}</style>
        </div>
    );
}
