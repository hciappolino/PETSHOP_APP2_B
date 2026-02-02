import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Proveedores() {
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState({ activo: 'true' });

    // Modals state
    const [showFormModal, setShowFormModal] = useState(false);
    const [selectedProveedor, setSelectedProveedor] = useState(null);

    // Cuenta Corriente state
    const [showCuentaCorriente, setShowCuentaCorriente] = useState(false);
    const [selectedProveedorCC, setSelectedProveedorCC] = useState(null);
    const [facturas, setFacturas] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [loadingCC, setLoadingCC] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: ''
    });

    const { isAdmin, isGerente } = useAuth();
    const canEdit = isAdmin || isGerente;

    useEffect(() => {
        loadProveedores();
    }, [search, filter]);

    const loadProveedores = async () => {
        try {
            setLoading(true);
            const params = {
                search,
                activo: filter.activo
            };
            const response = await api.get('/proveedores', { params });
            setProveedores(response.data);
        } catch (error) {
            setError('Error al cargar proveedores: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const loadCuentaCorriente = async (proveedorId) => {
        try {
            setLoadingCC(true);
            // Get all invoices for this provider
            const facturasRes = await api.get(`/compras?proveedor_id=${proveedorId}`);
            const facturasData = facturasRes.data || [];
            setFacturas(facturasData);

            // Get payments for each invoice
            const pagosPromises = facturasData.map(f => 
                api.get(`/compras/${f.id}/pagos`)
                    .catch(err => {
                        console.error(`Error cargando pagos de factura ${f.id}:`, err);
                        return { data: [] };
                    })
            );
            
            const pagosResults = await Promise.all(pagosPromises);
            const todosPagos = pagosResults.flatMap(res => res.data || []);
            setPagos(todosPagos);
        } catch (error) {
            console.error('Error al cargar cuenta corriente:', error);
            setFacturas([]);
            setPagos([]);
        } finally {
            setLoadingCC(false);
        }
    };

    const handleOpenCuentaCorriente = (proveedor) => {
        setSelectedProveedorCC(proveedor);
        setShowCuentaCorriente(true);
        loadCuentaCorriente(proveedor.id);
    };

    const handleOpenForm = (proveedor = null) => {
        if (proveedor) {
            setSelectedProveedor(proveedor);
            setFormData({
                nombre: proveedor.nombre,
                contacto: proveedor.contacto || '',
                telefono: proveedor.telefono || '',
                email: proveedor.email || '',
                direccion: proveedor.direccion || ''
            });
        } else {
            setSelectedProveedor(null);
            setFormData({
                nombre: '',
                contacto: '',
                telefono: '',
                email: '',
                direccion: ''
            });
        }
        setShowFormModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedProveedor) {
                await api.put(`/proveedores/${selectedProveedor.id}`, formData);
            } else {
                await api.post('/proveedores', formData);
            }
            setShowFormModal(false);
            loadProveedores();
        } catch (error) {
            setError('Error al guardar proveedor: ' + (error.response?.data?.error || error.message));
        }
    };

    // Calcular resumen de cuenta corriente
    const calcularResumenCC = () => {
        const totalFacturas = facturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
        const totalPagado = facturas.reduce((sum, f) => sum + parseFloat(f.monto_pagado || 0), 0);
        const totalAdeudado = totalFacturas - totalPagado;
        const facturasAbiertas = facturas.filter(f => !f.pagado).length;
        const facturasAbiertas$ = facturas.filter(f => !f.pagado).reduce((sum, f) => sum + parseFloat(f.total || 0), 0);

        return {
            totalFacturas,
            totalPagado,
            totalAdeudado,
            facturasAbiertas,
            facturasAbiertas$
        };
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            {/* NAVEGACIÓN SUPERIOR - Proveedores / Compras */}
            <div className="flex gap-lg mb-lg" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
                <a href="/app/proveedores" className="text-lg font-semibold" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>🏢 Proveedores</a>
                <a href="/app/compras" className="text-lg font-semibold" style={{ color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.7 }}>📋 Compras</a>
            </div>

            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Proveedores</h1>
                    <p className="text-secondary">Gestión de proveedores comerciales</p>
                </div>
                {canEdit && (
                    <button className="btn btn-primary" onClick={() => handleOpenForm()}>
                        + Nuevo Proveedor
                    </button>
                )}
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            <div className="card mb-lg">
                <div className="flex gap-md flex-wrap items-center">
                    <div className="flex-1 min-w-[300px]">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por nombre o contacto..."
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
                                <th>Nombre Empresa</th>
                                <th>Contacto</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proveedores.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <strong>{p.nombre}</strong>
                                        {!p.activo && <span className="badge badge-danger ml-sm">INACTIVO</span>}
                                    </td>
                                    <td>{p.contacto || '-'}</td>
                                    <td>{p.telefono || '-'}</td>
                                    <td>{p.email || '-'}</td>
                                    <td>
                                        <div className="flex gap-sm">
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={() => handleOpenCuentaCorriente(p)}
                                                title="Ver Cuenta Corriente"
                                            >
                                                📊 Cuenta Corriente
                                            </button>
                                            {canEdit && (
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => handleOpenForm(p)}
                                                    title="Editar"
                                                >
                                                    ✏️ Editar
                                                </button>
                                            )}
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
                        <h3>{selectedProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Nombre de la Empresa</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nombre de Contacto</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.contacto}
                                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                                />
                            </div>
                            <div className="grid-2 gap-md">
                                <div className="form-group">
                                    <label className="form-label">Teléfono</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.telefono}
                                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    />
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
                            <div className="flex justify-end gap-md mt-lg">
                                <button type="button" className="btn btn-outline" onClick={() => setShowFormModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {selectedProveedor ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Cuenta Corriente */}
            {showCuentaCorriente && selectedProveedorCC && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3 className="m-0">📊 Cuenta Corriente: {selectedProveedorCC.nombre}</h3>
                            <button className="btn btn-sm" onClick={() => setShowCuentaCorriente(false)}>✕</button>
                        </div>

                        {loadingCC ? (
                            <div className="text-center p-xl">
                                <div className="spinner mx-auto"></div>
                            </div>
                        ) : (
                            <>
                                {/* RESUMEN */}
                                {(() => {
                                    const resumen = calcularResumenCC();
                                    return (
                                        <div className="grid-2 gap-md mb-lg">
                                            <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                                                <p className="text-sm text-secondary m-0 mb-xs">Total Facturas</p>
                                                <h3 className="m-0 text-primary">${resumen.totalFacturas.toFixed(2)}</h3>
                                            </div>
                                            <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                                                <p className="text-sm text-secondary m-0 mb-xs">Total Pagado</p>
                                                <h3 className="m-0 text-success">${resumen.totalPagado.toFixed(2)}</h3>
                                            </div>
                                            <div className="card" style={{ background: 'var(--bg-secondary)', borderLeft: `4px solid ${resumen.totalAdeudado > 0 ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
                                                <p className={`text-sm m-0 mb-xs ${resumen.totalAdeudado > 0 ? 'text-danger' : 'text-success'}`}>{resumen.totalAdeudado > 0 ? '❌ Total Adeudado' : '✓ Sin Deuda'}</p>
                                                <h3 className={`m-0 ${resumen.totalAdeudado > 0 ? 'text-danger' : 'text-success'}`}>${resumen.totalAdeudado.toFixed(2)}</h3>
                                            </div>
                                            <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                                                <p className="text-sm text-secondary m-0 mb-xs">Facturas Pendientes</p>
                                                <h3 className="m-0">
                                                    {resumen.facturasAbiertas} <span className={`text-sm ${resumen.facturasAbiertas > 0 ? 'text-danger' : 'text-success'}`}>(${resumen.facturasAbiertas$.toFixed(2)})</span>
                                                </h3>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* FACTURAS */}
                                <div className="mb-lg">
                                    <h4 className="mb-md">Facturas de Compras</h4>
                                    {facturas.length === 0 ? (
                                        <div className="card text-center p-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--color-muted)' }}>
                                            <p className="m-0">No hay facturas registradas</p>
                                        </div>
                                    ) : (
                                        <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Factura #</th>
                                                        <th>Total</th>
                                                        <th>Pagado</th>
                                                        <th>Adeudado</th>
                                                        <th>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {facturas.map(f => {
                                                        const adeudado = f.total - (f.monto_pagado || 0);
                                                        return (
                                                            <tr key={f.id} style={{ opacity: f.pagado ? 0.7 : 1 }}>
                                                                <td>{new Date(f.fecha).toLocaleDateString()}</td>
                                                                <td><strong>{f.numero_factura || `ID: ${f.id}`}</strong></td>
                                                                <td>${parseFloat(f.total).toFixed(2)}</td>
                                                                <td className="text-success">${parseFloat(f.monto_pagado || 0).toFixed(2)}</td>
                                                                <td className={adeudado > 0 ? 'text-warning font-semibold' : 'text-success'}>
                                                                    ${adeudado.toFixed(2)}
                                                                </td>
                                                                <td>
                                                                    <span className={`badge ${f.pagado ? 'badge-success' : 'badge-warning'}`}>
                                                                        {f.pagado ? '✓ Pagado' : '⏳ Pendiente'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* PAGOS */}
                                <div className="mb-lg">
                                    <h4 className="mb-md">Historial de Pagos</h4>
                                    {pagos.length === 0 ? (
                                        <div className="card text-center p-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--color-muted)' }}>
                                            <p className="m-0">No hay pagos registrados</p>
                                        </div>
                                    ) : (
                                        <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Factura</th>
                                                        <th>Monto</th>
                                                        <th>Referencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pagos.map(p => (
                                                        <tr key={p.id}>
                                                            <td>{new Date(p.fecha_pago).toLocaleDateString()}</td>
                                                            <td><strong>{p.numero_factura || `ID: ${p.factura_id}`}</strong></td>
                                                            <td className="text-success font-semibold">${parseFloat(p.monto).toFixed(2)}</td>
                                                            <td>{p.referencia || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="flex justify-end">
                            <button className="btn btn-outline" onClick={() => setShowCuentaCorriente(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
