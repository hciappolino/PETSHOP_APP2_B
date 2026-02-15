import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const emptyLinea = () => ({
    descripcion: '',
    cantidad: 1,
    precio_costo: 0
});

export default function Gastos() {
    const [proveedores, setProveedores] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedProveedor, setSelectedProveedor] = useState('');
    const [numeroFactura, setNumeroFactura] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [lineas, setLineas] = useState([emptyLinea()]);

    const [pagoInmediato, setPagoInmediato] = useState(false);
    const [cuentaPago, setCuentaPago] = useState('');
    const [montoPago, setMontoPago] = useState('');
    const [montoManual, setMontoManual] = useState(false);
    const [referenciaPago, setReferenciaPago] = useState('');
    const [notasPago, setNotasPago] = useState('');

    const { hasPermission } = useAuth();
    const canEdit = hasPermission('compras.gastos');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [proveedoresRes, cuentasRes] = await Promise.all([
                api.get('/proveedores?activo=true'),
                api.get('/compras/cuentas/listar')
            ]);
            setProveedores(proveedoresRes.data);
            setCuentas(cuentasRes.data || []);
        } catch (e) {
            setError('Error al cargar datos: ' + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const total = useMemo(() => {
        return lineas.reduce((sum, l) => sum + (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio_costo) || 0), 0);
    }, [lineas]);

    useEffect(() => {
        if (pagoInmediato && !montoManual) {
            setMontoPago(total.toFixed(2));
        }
    }, [total, pagoInmediato, montoManual]);

    const updateLinea = (index, patch) => {
        setLineas(lineas.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    };

    const removeLinea = (index) => {
        if (lineas.length === 1) {
            setLineas([emptyLinea()]);
            return;
        }
        setLineas(lineas.filter((_, i) => i !== index));
    };

    const addLinea = () => setLineas([...lineas, emptyLinea()]);

    const handleSubmit = async () => {
        setError('');
        if (!canEdit) return;

        const lineasValidas = lineas.filter(l => l.descripcion.trim() && parseFloat(l.cantidad) > 0 && parseFloat(l.precio_costo) > 0);
        if (lineasValidas.length === 0) {
            setError('Debe agregar al menos un gasto con descripciÃ³n, cantidad y precio');
            return;
        }
        if (!selectedProveedor) {
            setError('Debe seleccionar un proveedor');
            return;
        }
        if (pagoInmediato && !cuentaPago) {
            setError('Debe seleccionar una cuenta para el pago inmediato');
            return;
        }

        try {
            setLoading(true);
            await api.post('/compras', {
                proveedor_id: selectedProveedor,
                numero_factura: numeroFactura,
                fecha,
                items: lineasValidas.map(l => ({
                    descripcion: l.descripcion,
                    cantidad: parseFloat(l.cantidad),
                    precio_costo: parseFloat(l.precio_costo)
                })),
                pago_inmediato: pagoInmediato,
                cuenta_pago_id: pagoInmediato ? parseInt(cuentaPago) : null,
                monto_pagado: pagoInmediato ? parseFloat(montoPago || total) : null,
                referencia_pago: pagoInmediato ? referenciaPago : null,
                notas_pago: pagoInmediato ? notasPago : null
            });

            alert('Gasto registrado exitosamente');
            setSelectedProveedor('');
            setNumeroFactura('');
            setFecha(new Date().toISOString().split('T')[0]);
            setLineas([emptyLinea()]);
            setPagoInmediato(false);
            setCuentaPago('');
            setMontoPago('');
            setMontoManual(false);
            setReferenciaPago('');
            setNotasPago('');
        } catch (e) {
            setError('Error al registrar gasto: ' + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex gap-lg mb-lg" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
                <a href="/app/proveedores" className="text-lg font-semibold" style={{ color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.7 }}>Proveedores</a>
                <a href="/app/compras" className="text-lg font-semibold" style={{ color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.7 }}>Compras</a>
                <a href="/app/compras/gastos" className="text-lg font-semibold" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Gastos/Servicios</a>
            </div>

            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Ingreso de Gastos / Servicios</h1>
                    <p className="text-secondary">Facturas que no afectan stock</p>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            <div className="card mb-lg">
                <div className="p-md" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="form-group">
                        <label className="form-label">Proveedor *</label>
                        <select
                            className="form-select"
                            value={selectedProveedor}
                            onChange={(e) => setSelectedProveedor(e.target.value)}
                        >
                            <option value="">Seleccione...</option>
                            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="form-group">
                            <label className="form-label">Nro Factura</label>
                            <input
                                type="text"
                                className="form-input"
                                value={numeroFactura}
                                onChange={(e) => setNumeroFactura(e.target.value)}
                                placeholder="FAC-001"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fecha</label>
                            <input
                                type="date"
                                className="form-input"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-md">
                    <h3>Detalle de Gastos</h3>
                    {lineas.map((l, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 40px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="DescripciÃ³n (ej: Factura de luz)"
                                value={l.descripcion}
                                onChange={(e) => updateLinea(i, { descripcion: e.target.value })}
                            />
                            <input
                                type="number"
                                className="form-input"
                                min="1"
                                step="1"
                                value={l.cantidad}
                                onChange={(e) => updateLinea(i, { cantidad: e.target.value })}
                            />
                            <input
                                type="number"
                                className="form-input"
                                min="0"
                                step="0.01"
                                value={l.precio_costo}
                                onChange={(e) => updateLinea(i, { precio_costo: e.target.value })}
                            />
                            <button className="btn btn-sm btn-danger" onClick={() => removeLinea(i)}>X</button>
                        </div>
                    ))}
                    <button className="btn btn-sm btn-outline" onClick={addLinea}>+ Agregar lÃ­nea</button>
                </div>

                <div className="p-md" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>TOTAL:</span>
                        <strong style={{ fontSize: '24px' }}>${total.toFixed(2)}</strong>
                    </div>
                </div>
            </div>

            <div className="card mb-lg">
                <div className="p-md">
                    <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            checked={pagoInmediato}
                            onChange={(e) => {
                                setPagoInmediato(e.target.checked);
                                setMontoManual(false);
                            }}
                        />
                        Pagar en el momento
                    </label>

                    {pagoInmediato && (
                        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="form-group">
                                <label className="form-label">Cuenta de pago *</label>
                                <select
                                    className="form-select"
                                    value={cuentaPago}
                                    onChange={(e) => setCuentaPago(e.target.value)}
                                >
                                    <option value="">Seleccione...</option>
                                    {cuentas.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monto a pagar</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    step="0.01"
                                    value={montoPago}
                                    onChange={(e) => {
                                        setMontoPago(e.target.value);
                                        setMontoManual(true);
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Referencia</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={referenciaPago}
                                    onChange={(e) => setReferenciaPago(e.target.value)}
                                    placeholder="Comprobante / Ticket"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notas</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={notasPago}
                                    onChange={(e) => setNotasPago(e.target.value)}
                                    placeholder="Observaciones"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || !canEdit}
            >
                {loading ? 'Procesando...' : 'Registrar Gasto'}
            </button>
        </div>
    );
}
