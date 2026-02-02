import { useEffect, useState } from 'react';
import api from '../api';

export default function ComprasListado() {
    const [compras, setCompras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ desde: '', hasta: '', proveedor: '', numero: '', estado: '' });
    const [proveedores, setProveedores] = useState([]);
    const [selected, setSelected] = useState(null);
    const [pagos, setPagos] = useState([]);
    
    // Estados para el modal de pago
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedCompra, setSelectedCompra] = useState(null);
    const [cuentasPago, setCuentasPago] = useState([]);
    const [paymentForm, setPaymentForm] = useState({ monto: '', cuenta_pago_id: '', referencia: '', notas: '' });
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadProveedores();
        loadCompras();
    }, []);

    const loadProveedores = async () => {
        try {
            const res = await api.get('/proveedores', { params: { activo: 'true' } });
            setProveedores(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadCompras = async () => {
        try {
            setLoading(true);
            const res = await api.get('/compras');
            setCompras(res.data);
            setError('');
        } catch (e) {
            setError('Error cargando compras');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (c) => {
        return c.filter(item => {
            if (filters.proveedor && item.proveedor_id?.toString() !== filters.proveedor) return false;
            if (filters.numero && !(item.numero_factura || '').toString().includes(filters.numero)) return false;
            if (filters.estado) {
                if (filters.estado === 'pagadas' && !item.pagado) return false;
                if (filters.estado === 'pendientes' && item.pagado) return false;
            }
            if (filters.desde) {
                const desde = new Date(filters.desde);
                if (new Date(item.fecha) < desde) return false;
            }
            if (filters.hasta) {
                const hasta = new Date(filters.hasta);
                if (new Date(item.fecha) > hasta) return false;
            }
            return true;
        });
    };

    const filtered = applyFilters(compras);

    const handleView = async (id) => {
        try {
            const res = await api.get(`/compras/${id}`);
            setSelected(res.data);
            // Cargar pagos de la factura
            loadPagos(id);
        } catch (e) {
            setError('Error al cargar detalle');
        }
    };

    const loadPagos = async (compraId) => {
        try {
            const res = await api.get(`/compras/${compraId}/pagos`);
            setPagos(res.data);
        } catch (e) {
            console.error('Error cargando pagos:', e);
            setPagos([]);
        }
    };

    const openPayModal = async (compra) => {
        setSelectedCompra(compra);
        setShowPayModal(true);
        setLoadingAccounts(true);
        
        // Calcular saldo pendiente
        const montoPagado = parseFloat(compra.monto_pagado) || 0;
        const total = parseFloat(compra.total) || 0;
        const saldoPendiente = total - montoPagado;
        
        try {
            const res = await api.get('/cuentas-pago');
            setCuentasPago(res.data);
            const efectivo = res.data.find(c => c.nombre === 'Efectivo');
            setPaymentForm({ 
                monto: saldoPendiente.toFixed(2), 
                cuenta_pago_id: efectivo ? efectivo.id : (res.data[0]?.id || ''), 
                referencia: '',
                notas: ''
            });
        } catch (err) {
            setError('Error al cargar cuentas de pago: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingAccounts(false);
        }
    };

    const handleRegisterPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.monto || parseFloat(paymentForm.monto) <= 0) {
            setError('El monto debe ser mayor a 0');
            return;
        }
        if (!paymentForm.cuenta_pago_id) {
            setError('Debe seleccionar una cuenta de pago');
            return;
        }
        
        const montoPagar = parseFloat(paymentForm.monto);
        const montoPagado = parseFloat(selectedCompra.monto_pagado) || 0;
        const total = parseFloat(selectedCompra.total) || 0;
        const saldoPendiente = total - montoPagado;
        
        if (montoPagar > saldoPendiente) {
            setError(`El monto no puede exceder el saldo pendiente de $${saldoPendiente.toFixed(2)}`);
            return;
        }
        
        setSubmitting(true);
        try {
            await api.post(`/compras/${selectedCompra.id}/pagar`, {
                cuenta_pago_id: paymentForm.cuenta_pago_id,
                monto: montoPagar,
                referencia: paymentForm.referencia,
                notas: paymentForm.notas
            });
            
            setShowPayModal(false);
            setPaymentForm({ monto: '', cuenta_pago_id: '', referencia: '', notas: '' });
            setError('');
            
            // Recargar datos
            await loadCompras();
            
            // Si el modal de detalle está abierto, recargar los pagos
            if (selected && selected.id === selectedCompra.id) {
                await loadPagos(selectedCompra.id);
                // Actualizar el selected con los nuevos datos
                const res = await api.get(`/compras/${selectedCompra.id}`);
                setSelected(res.data);
            }
        } catch (err) {
            setError('Error al registrar pago: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handlePagarTotal = () => {
        if (selectedCompra) {
            const montoPagado = parseFloat(selectedCompra.monto_pagado) || 0;
            const total = parseFloat(selectedCompra.total) || 0;
            const saldoPendiente = total - montoPagado;
            setPaymentForm({ ...paymentForm, monto: saldoPendiente.toFixed(2) });
        }
    };

    const getSaldoPendiente = (compra) => {
        const montoPagado = parseFloat(compra.monto_pagado) || 0;
        const total = parseFloat(compra.total) || 0;
        return total - montoPagado;
    };

    return (
        <div className="container" style={{ padding: '1.5rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Listado de Compras</h1>
                    <p className="text-secondary">Filtre y haga clic en una factura para ver el detalle</p>
                </div>
            </div>

            <div className="card mb-lg p-md">
                <div className="grid-4 gap-md">
                    <input type="date" className="form-input" value={filters.desde} onChange={e => setFilters({...filters, desde: e.target.value})} />
                    <input type="date" className="form-input" value={filters.hasta} onChange={e => setFilters({...filters, hasta: e.target.value})} />
                    <select className="form-input" value={filters.proveedor} onChange={e => setFilters({...filters, proveedor: e.target.value})}>
                        <option value="">Todos los proveedores</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="text" className="form-input" placeholder="Nro factura..." value={filters.numero} onChange={e => setFilters({...filters, numero: e.target.value})} />
                </div>
                <div className="flex gap-sm mt-md">
                    <select className="form-input w-48" value={filters.estado} onChange={e => setFilters({...filters, estado: e.target.value})}>
                        <option value="">Cualquier estado</option>
                        <option value="pagadas">Pagadas</option>
                        <option value="pendientes">Pendientes</option>
                    </select>
                    <button className="btn btn-outline" onClick={() => { setFilters({ desde: '', hasta: '', proveedor: '', numero: '', estado: '' }); }}>Limpiar</button>
                    <button className="btn btn-primary" onClick={loadCompras}>Actualizar</button>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Factura</th>
                                <th>Proveedor</th>
                                <th>Total</th>
                                <th>Pagado</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="text-center">Cargando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="8" className="text-center">No se encontraron facturas</td></tr>
                            ) : filtered.map(c => {
                                const saldoPendiente = getSaldoPendiente(c);
                                return (
                                    <tr key={c.id}>
                                        <td>{new Date(c.fecha).toLocaleDateString()}</td>
                                        <td>{c.numero_factura || `ID:${c.id}`}</td>
                                        <td>{c.proveedor_nombre}</td>
                                        <td className="text-right">${parseFloat(c.total).toFixed(2)}</td>
                                        <td className="text-right">${parseFloat(c.monto_pagado || 0).toFixed(2)}</td>
                                        <td className={`text-right ${saldoPendiente > 0 ? 'text-danger' : 'text-success'}`}>
                                            ${saldoPendiente.toFixed(2)}
                                        </td>
                                        <td>
                                            {c.pagado ? (
                                                <span className="badge badge-success">Pagada</span>
                                            ) : (
                                                <span className="badge badge-warning">Pendiente</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button className="btn btn-sm btn-outline" onClick={() => handleView(c.id)}>Ver</button>
                                                {!c.pagado && saldoPendiente > 0 && (
                                                    <button 
                                                        className="btn btn-sm btn-primary" 
                                                        onClick={() => openPayModal(c)}
                                                        title="Registrar pago"
                                                    >
                                                        💵 Pagar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalle */}
            {selected && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '900px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3>Detalle {selected.numero_factura || selected.id}</h3>
                            <button className="btn btn-sm" onClick={() => { setSelected(null); setPagos([]); }}>✕</button>
                        </div>
                        
                        {/* Información de pagos */}
                        <div className="card mb-md" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="flex justify-between items-center mb-md">
                                <h4>💰 Estado de Pago</h4>
                                {!selected.pagado && getSaldoPendiente(selected) > 0 && (
                                    <button 
                                        className="btn btn-sm btn-primary" 
                                        onClick={() => openPayModal(selected)}
                                    >
                                        💵 Registrar Pago
                                    </button>
                                )}
                            </div>
                            <div className="grid-3 gap-md">
                                <div>
                                    <span className="text-muted">Total Factura:</span>
                                    <h4>${parseFloat(selected.total).toFixed(2)}</h4>
                                </div>
                                <div>
                                    <span className="text-muted">Monto Pagado:</span>
                                    <h4 className="text-success">${parseFloat(selected.monto_pagado || 0).toFixed(2)}</h4>
                                </div>
                                <div>
                                    <span className="text-muted">Saldo Pendiente:</span>
                                    <h4 className={getSaldoPendiente(selected) > 0 ? 'text-danger' : 'text-success'}>
                                        ${getSaldoPendiente(selected).toFixed(2)}
                                    </h4>
                                </div>
                            </div>
                        </div>

                        {/* Historial de pagos */}
                        {pagos.length > 0 && (
                            <div className="mb-md">
                                <h4 className="mb-sm">📋 Historial de Pagos</h4>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Cuenta</th>
                                                <th>Monto</th>
                                                <th>Referencia</th>
                                                <th>Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagos.map(pago => (
                                                <tr key={pago.id}>
                                                    <td>{new Date(pago.fecha_pago).toLocaleDateString()}</td>
                                                    <td>{pago.cuenta_nombre}</td>
                                                    <td className="text-success">${parseFloat(pago.monto).toFixed(2)}</td>
                                                    <td>{pago.referencia || '-'}</td>
                                                    <td>{pago.usuario_nombre}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <h4 className="mb-sm">📦 Items de la Compra</h4>
                        <div className="table-container mb-md">
                            <table>
                                <thead>
                                    <tr><th>Producto/Detalle</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
                                </thead>
                                <tbody>
                                    {selected.items.map(it => (
                                        <tr key={it.id || Math.random()}>
                                            <td>{it.producto_nombre || it.descripcion}</td>
                                            <td>{it.cantidad}</td>
                                            <td>${parseFloat(it.precio_costo).toFixed(2)}</td>
                                            <td>${parseFloat(it.subtotal).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end">
                            <button className="btn btn-outline" onClick={() => { setSelected(null); setPagos([]); }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Pago */}
            {showPayModal && selectedCompra && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3>💵 Registrar Pago</h3>
                            <button className="btn btn-sm" onClick={() => setShowPayModal(false)}>✕</button>
                        </div>
                        
                        <div className="card mb-md" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="mb-sm">
                                <span className="text-muted">Factura:</span> <strong>{selectedCompra.numero_factura || `ID:${selectedCompra.id}`}</strong>
                            </div>
                            <div className="mb-sm">
                                <span className="text-muted">Proveedor:</span> <strong>{selectedCompra.proveedor_nombre}</strong>
                            </div>
                            <div className="grid-2 gap-md mt-md">
                                <div>
                                    <span className="text-muted">Total:</span>
                                    <h4>${parseFloat(selectedCompra.total).toFixed(2)}</h4>
                                </div>
                                <div>
                                    <span className="text-muted">Saldo Pendiente:</span>
                                    <h4 className="text-danger">${getSaldoPendiente(selectedCompra).toFixed(2)}</h4>
                                </div>
                            </div>
                        </div>

                        {loadingAccounts ? (
                            <div className="text-center p-md">
                                <div className="spinner mx-auto"></div>
                                <p className="mt-sm text-muted">Cargando cuentas...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleRegisterPayment}>
                                <div className="form-group">
                                    <label className="form-label">Monto a Pagar *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={getSaldoPendiente(selectedCompra)}
                                        className="form-input"
                                        value={paymentForm.monto}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, monto: e.target.value })}
                                        required
                                    />
                                    <small className="text-muted">
                                        Máximo: ${getSaldoPendiente(selectedCompra).toFixed(2)}
                                    </small>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">Cuenta de Pago *</label>
                                    <select
                                        className="form-input"
                                        value={paymentForm.cuenta_pago_id}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, cuenta_pago_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccione una cuenta</option>
                                        {cuentasPago.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre} (Saldo: ${parseFloat(c.saldo_actual || 0).toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">Referencia / Notas</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Número de comprobante, transferencia, etc."
                                        value={paymentForm.referencia}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, referencia: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-sm mb-lg">
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary flex-1"
                                        onClick={handlePagarTotal}
                                    >
                                        Pagar Total (${getSaldoPendiente(selectedCompra).toFixed(2)})
                                    </button>
                                </div>

                                <div className="flex justify-end gap-md">
                                    <button 
                                        type="button" 
                                        className="btn btn-outline" 
                                        onClick={() => setShowPayModal(false)}
                                        disabled={submitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Procesando...' : '💵 Registrar Pago'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
