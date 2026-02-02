import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Clientes() {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState({ activo: 'true' });

    // Modals state
    const [showFormModal, setShowFormModal] = useState(false);
    const [showCCModal, setShowCCModal] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState(null);
    const [ccData, setCCData] = useState(null);
    const [loadingCC, setLoadingCC] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ monto: '', cuenta_pago_id: '', referencia: '' });
    const [cuentasPago, setCuentasPago] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        dni_cuit: '',
        telefono: '',
        email: '',
        direccion: '',
        saldo_cc: 0
    });

    const { isAdmin, isGerente } = useAuth();
    const canEdit = isAdmin || isGerente;

    useEffect(() => {
        loadClientes();
    }, [search, filter]);

    const loadClientes = async () => {
        try {
            setLoading(true);
            const params = {
                search,
                activo: filter.activo
            };
            const response = await api.get('/clientes', { params });
            setClientes(response.data);
        } catch (error) {
            setError('Error al cargar clientes: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForm = (cliente = null) => {
        if (cliente) {
            setSelectedCliente(cliente);
            setFormData({
                nombre: cliente.nombre,
                dni_cuit: cliente.dni_cuit || '',
                telefono: cliente.telefono || '',
                email: cliente.email || '',
                direccion: cliente.direccion || '',
                saldo_cc: cliente.saldo_cc
            });
        } else {
            setSelectedCliente(null);
            setFormData({
                nombre: '',
                dni_cuit: '',
                telefono: '',
                email: '',
                direccion: '',
                saldo_cc: 0
            });
        }
        setShowFormModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedCliente) {
                await api.put(`/clientes/${selectedCliente.id}`, formData);
            } else {
                await api.post('/clientes', formData);
            }
            setShowFormModal(false);
            loadClientes();
        } catch (error) {
            setError('Error al guardar cliente: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleViewCC = async (cliente) => {
        setSelectedCliente(cliente);
        setShowCCModal(true);
        setLoadingCC(true);
        try {
            const response = await api.get(`/clientes/${cliente.id}/cuenta-corriente`);
            setCCData(response.data);
        } catch (error) {
            setError('Error al cargar cuenta corriente: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoadingCC(false);
        }
    };

    const openPayModal = async (cliente) => {
        setSelectedCliente(cliente);
        setShowPayModal(true);
        setLoadingAccounts(true);
        try {
            const res = await api.get('/cuentas-pago');
            setCuentasPago(res.data);
            const efectivo = res.data.find(c => c.nombre === 'Efectivo');
            setPaymentForm({ monto: '', cuenta_pago_id: efectivo ? efectivo.id : (res.data[0]?.id || ''), referencia: '' });
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
        try {
            const res = await api.post(`/clientes/${selectedCliente.id}/pagos`, paymentForm);
            setShowPayModal(false);
            setPaymentForm({ monto: '', cuenta_pago_id: '', referencia: '' });
            setError(''); // Clear any previous errors
            // refresh cliente data and cc modal if open
            loadClientes();
            if (showCCModal) {
                const response = await api.get(`/clientes/${selectedCliente.id}/cuenta-corriente`);
                setCCData(response.data);
            }
        } catch (err) {
            setError('Error al registrar pago: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Clientes</h1>
                    <p className="text-secondary">Gestión de clientes y cuentas corrientes</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenForm()}>
                    + Nuevo Cliente
                </button>
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
                    <div className="w-[150px]">
                        <select
                            className="form-select"
                            value={filter.activo}
                            onChange={(e) => setFilter({ ...filter, activo: e.target.value })}
                        >
                            <option value="true">Activos</option>
                            <option value="false">Inactivos</option>
                            <option value="">Todos</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-xl">
                    <div className="spinner mx-auto"></div>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>DNI/CUIT</th>
                                <th>Teléfono</th>
                                <th>Saldo CC</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientes.map(c => (
                                <tr key={c.id}>
                                    <td>
                                        <strong>{c.nombre}</strong>
                                        {!c.activo && <span className="badge badge-danger ml-sm">INACTIVO</span>}
                                    </td>
                                    <td>{c.dni_cuit || '-'}</td>
                                    <td>{c.telefono || '-'}</td>
                                    <td>
                                        <span className={parseFloat(c.saldo_cc) > 0 ? 'text-danger font-bold' : 'text-success'}>
                                            ${parseFloat(c.saldo_cc).toFixed(2)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-sm">
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={() => handleOpenForm(c)}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleViewCC(c)}
                                                title="Cuenta Corriente"
                                            >
                                                📑 CC
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Formulario */}
            {showFormModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>{selectedCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Nombre Completo</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                />
                            </div>
                            <div className="grid-2 gap-md">
                                <div className="form-group">
                                    <label className="form-label">DNI / CUIT</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.dni_cuit}
                                        onChange={(e) => setFormData({ ...formData, dni_cuit: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Teléfono</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.telefono}
                                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.direccion}
                                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                />
                            </div>
                            {!selectedCliente && (
                                <div className="form-group">
                                    <label className="form-label">Saldo Inicial CC</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={formData.saldo_cc}
                                        onChange={(e) => setFormData({ ...formData, saldo_cc: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-md mt-lg">
                                <button type="button" className="btn btn-outline" onClick={() => setShowFormModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {selectedCliente ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Cuenta Corriente */}
            {showCCModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '800px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3>Cuenta Corriente: {selectedCliente?.nombre}</h3>
                            <button className="btn btn-sm" onClick={() => setShowCCModal(false)}>✕</button>
                        </div>

                        {loadingCC ? (
                            <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
                        ) : ccData && (
                            <>
                                <div className="card mb-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                    <div className="flex justify-between">
                                        <span>Estado de Cuenta:</span>
                                        <h2 className={parseFloat(ccData.cliente.saldo_cc) > 0 ? 'text-danger' : 'text-success'}>
                                            ${parseFloat(ccData.cliente.saldo_cc).toFixed(2)}
                                        </h2>
                                    </div>
                                </div>

                                        <div className="flex justify-between items-center">
                                            <h4>Últimos Movimientos (Ventas y Pagos a CC)</h4>
                                            <div>
                                                <button className="btn btn-sm btn-primary" onClick={() => openPayModal(selectedCliente)}>Registrar Pago</button>
                                            </div>
                                        </div>
                                <div className="table-container mt-md">
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
                                            {ccData.movimientos.length > 0 ? ccData.movimientos.map(m => (
                                                <tr key={`${m.tipo}-${m.id}`}>
                                                    <td>{new Date(m.fecha).toLocaleDateString()}</td>
                                                    <td>{m.tipo === 'PAGO' ? (m.descripcion || 'Pago registrado') : `Venta #${m.id}`}</td>
                                                    <td>
                                                        {m.tipo === 'PAGO' ? (
                                                            <span className="badge badge-success">PAGO</span>
                                                        ) : (
                                                            <span className="badge badge-info">{m.tipo_venta}</span>
                                                        )}
                                                    </td>
                                                    <td className={m.tipo === 'PAGO' ? 'text-success font-bold' : 'text-danger font-bold'}>
                                                        {m.tipo === 'PAGO' ? '+' : '-'}${parseFloat(m.monto).toFixed(2)}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="4" className="text-center text-muted">No hay movimientos recientes</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-lg p-md text-muted text-sm border-top">
                                    * Los pagos se registran como movimientos de fondos que afectan el saldo.
                                </div>
                            </>
                        )}
                        <div className="flex justify-end mt-lg">
                            <button className="btn btn-primary" onClick={() => setShowCCModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Registrar Pago */}
            {showPayModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Registrar Pago - {selectedCliente?.nombre}</h3>
                        <form onSubmit={handleRegisterPayment}>
                            <div className="form-group">
                                <label className="form-label">Monto</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    value={paymentForm.monto}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, monto: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cuenta de Pago</label>
                                <select
                                    className="form-select"
                                    value={paymentForm.cuenta_pago_id}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, cuenta_pago_id: e.target.value })}
                                    required
                                >
                                    {cuentasPago.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Referencia / Notas</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={paymentForm.referencia}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, referencia: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-md mt-lg">
                                <button type="button" className="btn btn-outline" onClick={() => setShowPayModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Registrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
