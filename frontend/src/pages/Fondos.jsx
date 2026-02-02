import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Fondos() {
    const [cuentas, setCuentas] = useState([]);
    const [balanceTotal, setBalanceTotal] = useState(0);
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCuenta, setSelectedCuenta] = useState('');
    const [dateRange, setDateRange] = useState('HOY'); // HOY, AYER, MES, MES_ANT, TODO

    // Estados para ABM de cuentas
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [accountForm, setAccountForm] = useState({
        nombre: '',
        tipo: 'BANCO',
        saldo_inicial: ''
    });

    // Estados para balanceo
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [balancingAccount, setBalancingAccount] = useState(null);
    const [balanceDestinoId, setBalanceDestinoId] = useState('');

    const { isAdmin, isGerente } = useAuth();
    const canEdit = isAdmin || isGerente;

    const getDates = (range) => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        switch (range) {
            case 'HOY':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'AYER':
                start.setDate(now.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(now.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case 'MES':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'MES_ANT':
                start.setMonth(now.getMonth() - 1);
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(now.getMonth());
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'TODO':
                return { since: null, to: null };
            default:
                return { since: null, to: null };
        }

        return {
            since: start.toISOString(),
            to: end.toISOString()
        };
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const { since, to } = getDates(dateRange);

            const params = {};
            if (selectedCuenta) params.cuenta_id = selectedCuenta;
            if (since) params.fecha_desde = since;
            if (to) params.fecha_hasta = to;

            const [cuentasRes, balanceRes, movRes] = await Promise.all([
                api.get('/cuentas-pago'),
                api.get('/cuentas-pago/balance-total'),
                api.get('/fondos-movimientos', { params })
            ]);

            setCuentas(cuentasRes.data);
            setBalanceTotal(balanceRes.data.total || 0);
            setMovimientos(movRes.data);
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            console.error('Error loading fondos data:', errorMsg);
            setError('Error al cargar datos financieros: ' + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [dateRange, selectedCuenta]);

    const openAccountModal = (cuenta = null) => {
        if (cuenta) {
            setEditingAccount(cuenta);
            setAccountForm({
                nombre: cuenta.nombre,
                tipo: cuenta.tipo,
                saldo_inicial: ''
            });
        } else {
            setEditingAccount(null);
            setAccountForm({
                nombre: '',
                tipo: 'BANCO',
                saldo_inicial: ''
            });
        }
        setShowAccountModal(true);
    };

    const handleSaveAccount = async (e) => {
        e.preventDefault();
        try {
            if (editingAccount) {
                await api.put(`/cuentas-pago/${editingAccount.id}`, {
                    nombre: accountForm.nombre,
                    tipo: accountForm.tipo,
                    activo: editingAccount.activo
                });
            } else {
                await api.post('/cuentas-pago', {
                    nombre: accountForm.nombre,
                    tipo: accountForm.tipo,
                    saldo_inicial: parseFloat(accountForm.saldo_inicial) || 0
                });
            }
            setShowAccountModal(false);
            loadData();
        } catch (err) {
            setError('Error al guardar cuenta: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleToggleAccountStatus = async (cuenta) => {
        const accion = cuenta.activo ? 'desactivar' : 'activar';
        const mensaje = cuenta.activo 
            ? `¿Desea desactivar la cuenta "${cuenta.nombre}"?\n\nLas cuentas con movimientos históricos no pueden desactivarse para preservar la trazabilidad.`
            : `¿Desea activar la cuenta "${cuenta.nombre}"?`;
        
        if (!confirm(mensaje)) {
            return;
        }
        try {
            await api.delete(`/cuentas-pago/${cuenta.id}`);
            loadData();
        } catch (err) {
            setError('Error al cambiar estado de cuenta: ' + (err.response?.data?.error || err.message));
        }
    };

    const openBalanceModal = (cuenta) => {
        setBalancingAccount(cuenta);
        setBalanceDestinoId('');
        setShowBalanceModal(true);
    };

    const handleBalance = async (e) => {
        e.preventDefault();
        if (!balanceDestinoId) {
            setError('Debe seleccionar una cuenta destino');
            return;
        }
        try {
            await api.post(`/cuentas-pago/${balancingAccount.id}/balancear`, {
                cuenta_destino_id: balanceDestinoId
            });
            setShowBalanceModal(false);
            loadData();
        } catch (err) {
            setError('Error al balancear cuenta: ' + (err.response?.data?.error || err.message));
        }
    };

    // Función para formatear moneda con separadores de miles
    const formatMoney = (amount) => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const getTipoIcon = (tipo) => {
        switch (tipo) {
            case 'EFECTIVO': return '💵';
            case 'BANCO': return '🏦';
            case 'DIGITAL': return '📱';
            case 'EXTERNA': return '⚡';
            default: return '💰';
        }
    };

    const getTipoColor = (tipo) => {
        switch (tipo) {
            case 'EFECTIVO': return '#10b981';
            case 'BANCO': return '#3b82f6';
            case 'DIGITAL': return '#8b5cf6';
            case 'EXTERNA': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-xl">
                <div>
                    <h1>Gestión de Fondos</h1>
                    <p className="text-secondary">Saldos de cuentas e historial de transacciones</p>
                </div>
                <div className="flex gap-md">
                    {canEdit && (
                        <button className="btn btn-primary" onClick={() => openAccountModal()}>
                            + Nueva Cuenta
                        </button>
                    )}
                    <div className="card" style={{ padding: '1rem 2rem', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--primary-color)' }}>
                        <small className="text-muted block">Balance Total Consolidado</small>
                        <h2 className="m-0">${formatMoney(balanceTotal)}</h2>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
                {cuentas.map(cuenta => (
                    <div
                        key={cuenta.id}
                        className={`card hover-scale cursor-pointer transition-all ${selectedCuenta == cuenta.id ? 'border-primary' : ''} ${!cuenta.activo ? 'opacity-50' : ''}`}
                        onClick={() => setSelectedCuenta(selectedCuenta == cuenta.id ? '' : cuenta.id)}
                        style={{ borderLeft: `4px solid ${getTipoColor(cuenta.tipo)}` }}
                    >
                        <div className="flex justify-between items-start mb-md">
                            <div>
                                <h3 className="m-0">{cuenta.nombre}</h3>
                                <div className="flex gap-sm mt-sm">
                                    <span className="badge badge-info">{cuenta.tipo}</span>
                                    {!cuenta.activo && <span className="badge badge-danger">INACTIVA</span>}
                                </div>
                            </div>
                            <span className="text-2xl">{getTipoIcon(cuenta.tipo)}</span>
                        </div>
                        <div className="mt-md">
                            <small className="text-muted">Saldo Disponible</small>
                            <h2 className="m-0">${formatMoney(cuenta.saldo_actual)}</h2>
                        </div>
                        {canEdit && cuenta.activo && (
                            <div className="flex gap-sm mt-md pt-md border-top">
                                <button
                                    className="btn btn-sm btn-outline"
                                    onClick={(e) => { e.stopPropagation(); openAccountModal(cuenta); }}
                                >
                                    ✏️ Editar
                                </button>
                                {cuenta.tipo === 'EXTERNA' && parseFloat(cuenta.saldo_actual) !== 0 && (
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={(e) => { e.stopPropagation(); openBalanceModal(cuenta); }}
                                    >
                                        ⚖️ Balancear
                                    </button>
                                )}
                                {cuenta.activo ? (
                                    <button
                                        className="btn btn-sm btn-outline"
                                        onClick={(e) => { e.stopPropagation(); handleToggleAccountStatus(cuenta); }}
                                        title="Desactivar cuenta (solo si no tiene movimientos)"
                                    >
                                        👁️‍🗨️ Desactivar
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-sm btn-success"
                                        onClick={(e) => { e.stopPropagation(); handleToggleAccountStatus(cuenta); }}
                                    >
                                        ✅ Activar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="flex justify-between items-center mb-lg">
                    <div>
                        <h3 className="m-0">Movimientos</h3>
                        {selectedCuenta && <small className="text-muted"> - {cuentas.find(c => c.id == selectedCuenta)?.nombre}</small>}
                    </div>
                    <div className="flex gap-sm">
                        <select
                            className="form-select text-sm"
                            style={{ width: '150px' }}
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                        >
                            <option value="HOY">Hoy</option>
                            <option value="AYER">Ayer</option>
                            <option value="MES">Mes Actual</option>
                            <option value="MES_ANT">Mes Anterior</option>
                            <option value="TODO">Todos</option>
                        </select>
                        <select
                            className="form-select text-sm"
                            style={{ width: '200px' }}
                            value={selectedCuenta}
                            onChange={(e) => setSelectedCuenta(e.target.value)}
                        >
                            <option value="">Todas las cuentas</option>
                            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <button className="btn btn-outline btn-sm" onClick={loadData}>🔄</button>
                    </div>
                </div>

                    <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Cuenta</th>
                                <th>Tipo</th>
                                <th>Monto</th>
                                <th>Motivo</th>
                                <th>Descripción</th>
                                <th>Saldo Resultante</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center p-xl"><div className="spinner mx-auto"></div></td></tr>
                            ) : movimientos.length === 0 ? (
                                <tr><td colSpan="7" className="text-center p-xl text-muted">No se encontraron movimientos registrados</td></tr>
                            ) : (
                                movimientos.map(m => (
                                    <tr key={m.id}>
                                        <td className="text-xs">{new Date(m.created_at).toLocaleString()}</td>
                                        <td><strong>{m.cuenta_nombre}</strong></td>
                                        <td>
                                            <span className={`badge ${m.tipo === 'INGRESO' ? 'badge-success' : 'badge-danger'}`}>
                                                {m.tipo === 'INGRESO' ? '⬆ INGRESO' : '⬇ EGRESO'}
                                            </span>
                                        </td>
                                        <td className={`font-bold ${m.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}`}>
                                            {m.tipo === 'INGRESO' ? '+' : '-'}${formatMoney(m.monto)}
                                        </td>
                                        <td><small className="badge badge-outline">{m.motivo}</small></td>
                                        <td className="text-muted text-xs">{m.descripcion}</td>
                                        <td className="text-xs font-bold">${formatMoney(m.saldo_nuevo)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal para Crear/Editar Cuenta */}
            {showAccountModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3>{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                            <button className="btn btn-sm" onClick={() => setShowAccountModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSaveAccount}>
                            <div className="form-group">
                                <label className="form-label">Nombre *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={accountForm.nombre}
                                    onChange={(e) => setAccountForm({ ...accountForm, nombre: e.target.value })}
                                    required
                                    placeholder="Ej: Banco Santander, Caja Principal"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo *</label>
                                <select
                                    className="form-input"
                                    value={accountForm.tipo}
                                    onChange={(e) => setAccountForm({ ...accountForm, tipo: e.target.value })}
                                    required
                                    disabled={editingAccount}
                                >
                                    <option value="EFECTIVO">💵 Efectivo</option>
                                    <option value="BANCO">🏦 Banco</option>
                                    <option value="DIGITAL">📱 Digital (MercadoPago, etc)</option>
                                    <option value="EXTERNA">⚡ Extraordinaria</option>
                                </select>
                                <small className="text-muted">
                                    {accountForm.tipo === 'EXTERNA' 
                                        ? 'Las cuentas extraordinarias se usan para pagos externos y no están disponibles en el POS.' 
                                        : 'Seleccione el tipo de cuenta según corresponda.'}
                                </small>
                            </div>
                            {!editingAccount && (
                                <div className="form-group">
                                    <label className="form-label">Saldo Inicial</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        value={accountForm.saldo_inicial}
                                        onChange={(e) => setAccountForm({ ...accountForm, saldo_inicial: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-md mt-lg">
                                <button type="button" className="btn btn-outline" onClick={() => setShowAccountModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingAccount ? 'Guardar Cambios' : 'Crear Cuenta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Balancear Cuenta */}
            {showBalanceModal && balancingAccount && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3>⚖️ Balancear Cuenta</h3>
                            <button className="btn btn-sm" onClick={() => setShowBalanceModal(false)}>✕</button>
                        </div>
                        <div className="card mb-md" style={{ background: 'var(--bg-tertiary)' }}>
                            <p><strong>Cuenta a balancear:</strong> {balancingAccount.nombre}</p>
                            <p><strong>Saldo actual:</strong> <span className="text-danger">${formatMoney(balancingAccount.saldo_actual)}</span></p>
                            <p className="text-muted text-sm">Al balancear, el saldo se transferirá a la cuenta destino seleccionada y esta cuenta quedará en $0.</p>
                        </div>
                        <form onSubmit={handleBalance}>
                            <div className="form-group">
                                <label className="form-label">Cuenta Destino *</label>
                                <select
                                    className="form-input"
                                    value={balanceDestinoId}
                                    onChange={(e) => setBalanceDestinoId(e.target.value)}
                                    required
                                >
                                    <option value="">Seleccione cuenta destino</option>
                                    {cuentas
                                        .filter(c => c.id !== balancingAccount.id && c.activo && c.tipo !== 'EXTERNA')
                                        .map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre} (Saldo: ${formatMoney(c.saldo_actual)})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-md mt-lg">
                                <button type="button" className="btn btn-outline" onClick={() => setShowBalanceModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    ⚖️ Balancear Cuenta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
