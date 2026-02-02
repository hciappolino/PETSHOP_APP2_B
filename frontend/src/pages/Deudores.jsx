import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Debounce hook for search optimization
function useDebounce(value, delay = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

export default function Deudores() {
    const [deudores, setDeudores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('saldo_desc');
    const [selectedCliente, setSelectedCliente] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [ccData, setCCData] = useState(null);
    const [loadingCC, setLoadingCC] = useState(false);

    const debouncedSearch = useDebounce(search, 300);
    const navigate = useNavigate();
    const { isAdmin, isGerente } = useAuth();
    const canEdit = isAdmin || isGerente;

    // Memoized total debt calculation
    const totalDeuda = useMemo(() => {
        return deudores.reduce((sum, d) => sum + parseFloat(d.saldo_cc || 0), 0);
    }, [deudores]);

    // Memoized formatted total
    const formattedTotal = useMemo(() => {
        return parseFloat(totalDeuda || 0).toFixed(2);
    }, [totalDeuda]);

    const loadDeudores = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/clientes/reportes/deudores', {
                params: { search: debouncedSearch, sortBy }
            });
            // Handle both array (legacy) and object (paginated) responses
            setDeudores(Array.isArray(response.data) ? response.data : response.data.data || []);
            setError('');
        } catch (err) {
            setError('Error al cargar deudores: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, sortBy]);

    useEffect(() => {
        loadDeudores();
    }, [loadDeudores]);

    const formatCurrency = useCallback((value) => {
        return parseFloat(value || 0).toFixed(2);
    }, []);

    const handleViewDetails = useCallback(async (cliente) => {
        setSelectedCliente(cliente);
        setShowDetailModal(true);
        setLoadingCC(true);
        try {
            const response = await api.get(`/clientes/${cliente.id}/cuenta-corriente`);
            setCCData(response.data);
        } catch (err) {
            setError('Error al cargar detalles: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingCC(false);
        }
    }, []);

    const handleCloseModal = useCallback(() => {
        setShowDetailModal(false);
        setSelectedCliente(null);
        setCCData(null);
    }, []);

    const handleEditCliente = useCallback((clienteId) => {
        navigate(`/clientes?edit=${clienteId}`);
    }, [navigate]);

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Listado de Deudores</h1>
                    <p className="text-secondary">Clientes con saldo en cuenta corriente</p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-secondary">Deuda Total</div>
                    <div className="text-2xl font-bold text-danger">${formattedTotal}</div>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            <div className="card mb-lg">
                <div className="flex gap-md flex-wrap items-center">
                    <div className="flex-1 min-w-[300px]">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por nombre o DNI/CUIT..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="w-[200px]">
                        <select
                            className="form-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="saldo_desc">Mayor deuda primero</option>
                            <option value="saldo_asc">Menor deuda primero</option>
                            <option value="nombre">Por nombre (A-Z)</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="alert alert-info">Cargando deudores...</div>
            ) : deudores.length === 0 ? (
                <div className="alert alert-success">✓ ¡No hay deudores! Todos los clientes están al día.</div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>DNI/CUIT</th>
                                    <th>Teléfono</th>
                                    <th>Saldo Deuda</th>
                                    <th>Detalles</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deudores.map(cliente => (
                                    <tr key={cliente.id} className="hover:bg-secondary/50">
                                        <td className="font-bold">{cliente.nombre}</td>
                                        <td>{cliente.dni_cuit || '-'}</td>
                                        <td>{cliente.telefono || '-'}</td>
                                        <td>
                                            <span className="badge badge-danger">
                                                ${formatCurrency(cliente.saldo_cc)}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={() => handleViewDetails(cliente)}
                                            >
                                                Ver detalles
                                            </button>
                                        </td>
                                        <td>
                                            {canEdit && (
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleEditCliente(cliente.id)}
                                                >
                                                    Editar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Detalles de Deuda */}
            {showDetailModal && selectedCliente && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-md">
                            <h3>Detalles de {selectedCliente.nombre}</h3>
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={handleCloseModal}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-secondary/20 p-md rounded mb-lg">
                            <div className="grid grid-cols-2 gap-md">
                                <div>
                                    <span className="text-sm text-secondary">DNI/CUIT</span>
                                    <div className="font-bold">{selectedCliente.dni_cuit || '-'}</div>
                                </div>
                                <div>
                                    <span className="text-sm text-secondary">Teléfono</span>
                                    <div className="font-bold">{selectedCliente.telefono || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm text-secondary">Email</span>
                                    <div className="font-bold">{selectedCliente.email || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm text-secondary">Dirección</span>
                                    <div className="font-bold">{selectedCliente.direccion || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm text-secondary">Saldo Actual</span>
                                    <div className="text-2xl font-bold text-danger">
                                        ${formatCurrency(selectedCliente.saldo_cc)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {loadingCC ? (
                            <div className="alert alert-info">Cargando movimientos...</div>
                        ) : ccData ? (
                            <>
                                <h4 className="mb-md">Últimos Movimientos</h4>
                                <div className="table-container mb-md" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Concepto</th>
                                                <th>Tipo</th>
                                                <th>Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ccData.movimientos.length > 0 ? (
                                                ccData.movimientos.map(m => (
                                                    <tr key={`${m.tipo}-${m.id}`}>
                                                        <td>{new Date(m.fecha).toLocaleDateString()}</td>
                                                        <td className="text-sm">
                                                            {m.tipo === 'PAGO'
                                                                ? (m.descripcion || 'Pago registrado')
                                                                : `Venta #${m.id}`
                                                            }
                                                        </td>
                                                        <td>
                                                            {m.tipo === 'PAGO' ? (
                                                                <span className="badge badge-success">PAGO</span>
                                                            ) : (
                                                                <span className="badge badge-info">{m.tipo_venta}</span>
                                                            )}
                                                        </td>
                                                        <td className={m.tipo === 'PAGO' ? 'text-success font-bold' : 'text-danger font-bold'}>
                                                            {m.tipo === 'PAGO' ? '+' : '-'}${formatCurrency(m.monto)}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center text-muted">
                                                        No hay movimientos registrados
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : null}

                        <div className="flex justify-end gap-md">
                            <button
                                className="btn btn-outline"
                                onClick={handleCloseModal}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
