import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Compras() {
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Cart state (like POS)
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProveedor, setSelectedProveedor] = useState('');
    const [numeroFactura, setNumeroFactura] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [pagoInmediato, setPagoInmediato] = useState(false);
    const [cuentaPago, setCuentaPago] = useState('');
    const [montoPago, setMontoPago] = useState('');
    const [montoManual, setMontoManual] = useState(false);
    const [referenciaPago, setReferenciaPago] = useState('');
    const [notasPago, setNotasPago] = useState('');

    const { hasPermission } = useAuth();
    const canEdit = hasPermission('compras.crear');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [proveedoresRes, productosRes, cuentasRes] = await Promise.all([
                api.get('/proveedores?activo=true'),
                api.get('/productos?activo=true'),
                api.get('/compras/cuentas/listar')
            ]);
            setProveedores(proveedoresRes.data);
            setProductos(productosRes.data);
            setCuentas(cuentasRes.data || []);
        } catch (error) {
            setError('Error al cargar datos: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.codigo && p.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const addToCart = (producto, cantidad = 1) => {
        const existingItem = cart.find(item => item.producto_id === producto.id);
        
        if (existingItem) {
            setCart(cart.map(item =>
                item.producto_id === producto.id
                    ? { ...item, cantidad: item.cantidad + parseFloat(cantidad) }
                    : item
            ));
        } else {
            setCart([...cart, {
                producto_id: producto.id,
                nombre: producto.nombre,
                fabricante: producto.fabricante || '',
                marca: producto.marca || '',
                tipo_presentacion: producto.tipo_presentacion,
                cantidad: parseFloat(cantidad),
                precio_costo: parseFloat(producto.costo_ultima_compra || 0)
            }]);
        }
    };

    const incrementQuantity = (index) => {
        setCart(cart.map((item, i) =>
            i === index ? { 
                ...item, 
                cantidad: item.cantidad + 1
            } : item
        ));
    };

    const decrementQuantity = (index) => {
        const item = cart[index];
        const newQuantity = item.cantidad - 1;
        
        if (newQuantity <= 0) {
            removeFromCart(index);
        } else {
            setCart(cart.map((item, i) =>
                i === index ? { ...item, cantidad: newQuantity } : item
            ));
        }
    };

    const updateQuantity = (index, cantidad) => {
        if (cantidad <= 0) {
            removeFromCart(index);
            return;
        }
        setCart(cart.map((item, i) =>
            i === index ? { ...item, cantidad: parseFloat(cantidad) } : item
        ));
    };

    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const getTotal = () => {
        return cart.reduce((sum, item) => sum + (item.cantidad * item.precio_costo), 0);
    };

    useEffect(() => {
        if (pagoInmediato && !montoManual) {
            setMontoPago(getTotal().toFixed(2));
        }
    }, [cart, pagoInmediato, montoManual]);

    const handleSubmit = async () => {
        if (cart.length === 0) {
            alert('Debe agregar al menos un producto');
            return;
        }
        if (!selectedProveedor) {
            alert('Debe seleccionar un proveedor');
            return;
        }

        try {
            setLoading(true);
            await api.post('/compras', {
                proveedor_id: selectedProveedor,
                numero_factura: numeroFactura,
                fecha: fecha,
                items: cart.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    precio_costo: item.precio_costo
                })),
                pago_inmediato: pagoInmediato,
                cuenta_pago_id: pagoInmediato ? parseInt(cuentaPago) : null,
                monto_pagado: pagoInmediato ? parseFloat(montoPago || getTotal()) : null,
                referencia_pago: pagoInmediato ? referenciaPago : null,
                notas_pago: pagoInmediato ? notasPago : null
            });
            
            alert('Compra registrada exitosamente');
            setCart([]);
            setSelectedProveedor('');
            setNumeroFactura('');
            setPagoInmediato(false);
            setCuentaPago('');
            setMontoPago('');
            setMontoManual(false);
            setReferenciaPago('');
            setNotasPago('');
        } catch (error) {
            setError('Error al registrar compra: ' + (error.response?.data?.error || error.message));
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
                <a href="/app/compras" className="text-lg font-semibold" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Compras</a>
                <a href="/app/compras/gastos" className="text-lg font-semibold" style={{ color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.7 }}>Gastos/Servicios</a>
            </div>

            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Nueva Compra</h1>
                    <p className="text-secondary">Seleccione productos y cantidades</p>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
                {/* Products Grid */}
                <div className="card">
                    <div className="p-md" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por nombre, marca o codigo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1rem' }}>
                            {filteredProductos.map(producto => (
                                <div key={producto.id} className="product-card" style={{ 
                                    border: '1px solid var(--border-color)', 
                                    borderRadius: '8px',
                                    padding: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => addToCart(producto, 1)}
                                                        >
                                    <div style={{ 
                                        fontWeight: 'bold', 
                                        fontSize: '16px', 
                                        marginBottom: '4px',
                                        color: 'var(--color-primary)'
                                    }}>
                                        {producto.marca ? producto.marca.toUpperCase() : ''}
                                    </div>
                                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                                        {producto.nombre}
                                    </div>
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        fontSize: '12px',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <span>{producto.tipo_presentacion} {producto.codigo && `(${producto.codigo})`}</span>
                                        <strong style={{ color: 'var(--color-success)', fontSize: '14px' }}>${parseFloat(producto.costo_ultima_compra || 0).toFixed(2)}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Cart / Summary */}
                <div className="card">
                    <div className="p-md" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1rem 0' }}>Resumen de Compra</h3>
                        
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

                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {cart.length === 0 ? (
                            <div className="p-lg text-center text-muted">
                                No hay productos agregados
                            </div>
                        ) : (
                            cart.map((item, index) => (
                                <div key={index} style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderBottom: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ 
                                            fontWeight: 'bold', 
                                            fontSize: '14px', 
                                            color: 'var(--color-primary)',
                                            marginBottom: '2px'
                                        }}>
                                            {item.marca ? item.marca.toUpperCase() : ''}
                                        </div>
                                        <div style={{ fontSize: '13px' }}>
                                            {item.nombre}
                                        </div>
                                        <div className="text-sm text-muted" style={{ fontSize: '11px' }}>
                                            ${item.precio_costo.toFixed(2)} x unidad
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                            className="btn btn-sm"
                                            style={{ 
                                                width: '30px', 
                                                height: '30px', 
                                                padding: '0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: 'bold'
                                            }}
                                            onClick={() => decrementQuantity(index)}
                                        >
                                            -
                                        </button>
                                        <div style={{ 
                                            minWidth: '40px', 
                                            textAlign: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '14px'
                                        }}>
                                            {item.cantidad}
                                        </div>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            style={{ 
                                                width: '30px', 
                                                height: '30px', 
                                                padding: '0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: 'bold'
                                            }}
                                            onClick={() => incrementQuantity(index)}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div style={{ width: '80px', textAlign: 'right', fontWeight: 'bold' }}>
                                        ${(item.cantidad * item.precio_costo).toFixed(2)}
                                    </div>
                                    <button
                                        className="btn btn-sm btn-text text-danger"
                                        onClick={() => removeFromCart(index)}
                                    >
                                        X
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-md" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '18px' }}>TOTAL:</span>
                            <strong style={{ fontSize: '24px' }}>${getTotal().toFixed(2)}</strong>
                        </div>

                        <div className="mb-md">
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
                                        <div style={{ display: 'flex', gap: '6px' }}>
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
                                            <button
                                                className="btn btn-outline"
                                                type="button"
                                                onClick={() => {
                                                    setMontoPago(getTotal().toFixed(2));
                                                    setMontoManual(false);
                                                }}
                                            >
                                                Total
                                            </button>
                                        </div>
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
                        
                        <button
                            className="btn btn-primary w-full"
                            onClick={handleSubmit}
                            disabled={loading || cart.length === 0 || !selectedProveedor}
                        >
                            {loading ? 'Procesando...' : 'Registrar Compra'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
