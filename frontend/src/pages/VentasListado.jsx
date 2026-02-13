import { useState, useEffect } from 'react';
import api from '../api';

const FILTER_OPTIONS = {
    TODO: 'todo',
    HOY: 'hoy',
    AYER: 'ayer',
    SEMANA: 'semana',
    MES: 'mes',
    ANIO: 'anio',
    PERSONALIZADO: 'personalizado'
};

function VentasListado() {
    const [ventas, setVentas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(FILTER_OPTIONS.HOY);
    const [fechaDesde, setFechaDesde] = useState(() => new Date().toISOString().split('T')[0]);
    const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);
    const [cancelModal, setCancelModal] = useState({ show: false, venta: null, motivo: '' });
    const [error, setError] = useState('');

    // Helper to get date in local timezone (Buenos Aires)
    const getLocalDate = (date) => {
        const d = new Date(date);
        // Adjust for timezone offset
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset);
        return localDate.toISOString().split('T')[0];
    };

    // Calculate date ranges for each filter
    const calculateDateRange = (filter) => {
        const now = new Date();
        let desde, hasta;

        switch (filter) {
            case FILTER_OPTIONS.TODO:
                return { desde: null, hasta: null };

            case FILTER_OPTIONS.HOY:
                desde = getLocalDate(now);
                hasta = desde;
                return { desde, hasta };

            case FILTER_OPTIONS.AYER:
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                desde = getLocalDate(yesterday);
                hasta = desde;
                return { desde, hasta };

            case FILTER_OPTIONS.SEMANA:
                // Get Monday of current week
                const dayOfWeek = now.getDay();
                const monday = new Date(now);
                monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
                desde = getLocalDate(monday);
                // Sunday
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                hasta = getLocalDate(sunday);
                return { desde, hasta };

            case FILTER_OPTIONS.MES:
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                desde = getLocalDate(firstDayOfMonth);
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                hasta = getLocalDate(lastDayOfMonth);
                return { desde, hasta };

            case FILTER_OPTIONS.ANIO:
                const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
                desde = getLocalDate(firstDayOfYear);
                const lastDayOfYear = new Date(now.getFullYear(), 11, 31);
                hasta = getLocalDate(lastDayOfYear);
                return { desde, hasta };

            case FILTER_OPTIONS.PERSONALIZADO:
            default:
                return { fechaDesde, fechaHasta };
        }
    };

    // Handle filter button click
    const handleFilterChange = (filter) => {
        setSelectedFilter(filter);
        if (filter !== FILTER_OPTIONS.PERSONALIZADO) {
            const range = calculateDateRange(filter);
            if (range.desde && range.hasta) {
                setFechaDesde(range.desde);
                setFechaHasta(range.hasta);
            }
        }
    };

    useEffect(() => {
        fetchVentas();
    }, [selectedFilter, fechaDesde, fechaHasta]);

    const fetchVentas = async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedFilter !== FILTER_OPTIONS.TODO) {
                params.fecha_desde = fechaDesde;
                params.fecha_hasta = fechaHasta;
            }
            const response = await api.get('/ventas', { params });
            setVentas(response.data);
        } catch (err) {
            setError('Error al cargar ventas');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelClick = (venta) => {
        setCancelModal({ show: true, venta, motivo: '' });
    };

    const handleCancelConfirm = async () => {
        if (!cancelModal.motivo.trim()) {
            alert('Debe proporcionar un motivo para cancelar');
            return;
        }

        try {
            await api.post(`/ventas/${cancelModal.venta.id}/cancelar`, {
                motivo: cancelModal.motivo
            });
            setCancelModal({ show: false, venta: null, motivo: '' });
            fetchVentas();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al cancelar venta');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
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

    return (
        <div className="page-container">
            <h1>Listado de Ventas</h1>
            
            <div className="filter-section">
                <div className="filter-buttons">
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.TODO ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.TODO)}
                    >
                        Todo
                    </button>
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.HOY ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.HOY)}
                    >
                        Hoy
                    </button>
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.AYER ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.AYER)}
                    >
                        Ayer
                    </button>
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.SEMANA ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.SEMANA)}
                    >
                        Esta Semana
                    </button>
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.MES ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.MES)}
                    >
                        Este Mes
                    </button>
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.ANIO ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.ANIO)}
                    >
                        Este Año
                    </button>
                    <button 
                        className={`btn ${selectedFilter === FILTER_OPTIONS.PERSONALIZADO ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleFilterChange(FILTER_OPTIONS.PERSONALIZADO)}
                    >
                        Personalizado
                    </button>
                </div>
                
                {selectedFilter === FILTER_OPTIONS.PERSONALIZADO && (
                    <div className="custom-date-range">
                        <label>Desde:</label>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                        />
                        <label>Hasta:</label>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                        />
                        <button onClick={fetchVentas} className="btn btn-secondary">
                            Buscar
                        </button>
                    </div>
                )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading">Cargando...</div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Fecha/Hora</th>
                                <th>Cliente</th>
                                <th>Tipo</th>
                                <th>Total</th>
                                <th>Usuario</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ventas.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center' }}>
                                        {selectedFilter === FILTER_OPTIONS.TODO 
                                            ? 'No hay ventas registradas'
                                            : 'No hay ventas para el período seleccionado'}
                                    </td>
                                </tr>
                            ) : (
                                ventas.map((venta) => {
                                    const tipoBadge = getTipoVentaBadge(venta.tipo_venta);
                                    return (
                                        <tr key={venta.id} className={venta.cancelada ? 'row-cancelled' : ''}>
                                            <td>#{venta.id}</td>
                                            <td>{formatDateTime(venta.fecha)}</td>
                                            <td>{venta.cliente_nombre || 'Mostrador'}</td>
                                            <td>
                                                <span className={`badge ${tipoBadge.class}`}>
                                                    {tipoBadge.text}
                                                </span>
                                            </td>
                                            <td>{formatCurrency(venta.total)}</td>
                                            <td>{venta.usuario_nombre}</td>
                                            <td>
                                                {venta.cancelada ? (
                                                    <span className="badge badge-danger">
                                                        Cancelada
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-success">
                                                        Activa
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {!venta.cancelada && (
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleCancelClick(venta)}
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Cancel Modal */}
            {cancelModal.show && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Cancelar Venta #{cancelModal.venta?.id}</h2>
                        <div className="modal-body">
                            <p><strong>Cliente:</strong> {cancelModal.venta?.cliente_nombre || 'Mostrador'}</p>
                            <p><strong>Total:</strong> {formatCurrency(cancelModal.venta?.total)}</p>
                            <p><strong>Tipo:</strong> {cancelModal.venta?.tipo_venta === 'CUENTA_CORRIENTE' ? 'Cuenta Corriente' : 'Contado'}</p>
                            
                            <div className="form-group">
                                <label>Motivo de cancelación *:</label>
                                <textarea
                                    value={cancelModal.motivo}
                                    onChange={(e) => setCancelModal(prev => ({ ...prev, motivo: e.target.value }))}
                                    placeholder="Explique el motivo de la cancelación..."
                                    rows="3"
                                />
                            </div>
                            
                            <div className="warning-box">
                                <strong>⚠️ Esta acción revertirá:</strong>
                                <ul>
                                    <li>Stock de productos (entradas)</li>
                                    <li>Movimientos de fondos (egresos)</li>
                                    <li>Saldo de cliente (si era cuenta corriente)</li>
                                    <li>Uso de promociones aplicadas</li>
                                </ul>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setCancelModal({ show: false, venta: null, motivo: '' })}
                            >
                                Volver
                            </button>
                            <button 
                                className="btn btn-danger"
                                onClick={handleCancelConfirm}
                            >
                                Confirmar Cancelación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .filter-section {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    margin-bottom: 20px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .filter-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .filter-buttons .btn {
                    padding: 8px 12px;
                    font-size: 0.9em;
                }
                
                .custom-date-range {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .custom-date-range label {
                    font-weight: 500;
                    color: #333;
                }
                
                .custom-date-range input {
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                
                .badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.85em;
                }
                
                .badge-success { background: #28a745; color: white; }
                .badge-warning { background: #ffc107; color: #333; }
                .badge-danger { background: #dc3545; color: white; }
                .badge-secondary { background: #6c757d; color: white; }
                
                .row-cancelled {
                    opacity: 0.6;
                    background: #f8f9fa;
                }
                
                .btn-sm {
                    padding: 4px 8px;
                    font-size: 0.85em;
                }
                
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal {
                    background: white;
                    padding: 25px;
                    border-radius: 8px;
                    max-width: 450px;
                    width: 90%;
                }
                
                .modal h2 {
                    margin-top: 0;
                    color: #dc3545;
                }
                
                .modal-body {
                    margin: 20px 0;
                }
                
                .modal-body p {
                    margin: 8px 0;
                }
                
                .form-group textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    resize: vertical;
                }
                
                .warning-box {
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 12px;
                    border-radius: 4px;
                    margin-top: 15px;
                }
                
                .warning-box ul {
                    margin: 8px 0 0 0;
                    padding-left: 20px;
                }
                
                .warning-box li {
                    margin: 4px 0;
                    font-size: 0.9em;
                }
                
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 20px;
                }
            `}</style>
        </div>
    );
}

export default VentasListado;
