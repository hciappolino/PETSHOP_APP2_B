import { useState, useEffect } from 'react';
import api from '../api';
import './POS.css';

export default function POS() {
    const [productos, setProductos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [cuentasPago, setCuentasPago] = useState([]);
    const [listasPrecios, setListasPrecios] = useState([]);
    const [promociones, setPromociones] = useState([]);
    const [selectedLista, setSelectedLista] = useState('');
    const [cart, setCart] = useState([]);
    const [appliedPromociones, setAppliedPromociones] = useState([]);
    const [selectedCliente, setSelectedCliente] = useState('');
    const [selectedCuenta, setSelectedCuenta] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [processingSale, setProcessingSale] = useState(false);
    const [hasOpenSession, setHasOpenSession] = useState(false);

    // Modal state for bulk weight selection
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [selectedProductForWeight, setSelectedProductForWeight] = useState(null);
    const [customWeight, setCustomWeight] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedLista && hasOpenSession) {
            loadProductos();
        }
    }, [selectedLista, hasOpenSession]);

    const loadInitialData = async () => {
        try {
            const [clientRes, cuentasRes, listasRes, sessionRes, promoRes] = await Promise.all([
                api.get('/clientes?activo=true'),
                api.get('/cuentas-pago'),
                api.get('/listas-precios?activo=true'),
                api.get('/sesiones-caja/current'),
                api.get('/promociones/activas')
            ]);

            setClientes(clientRes.data);
            // Filtrar cuentas EXTERNA del POS - no están disponibles para cobros
            const cuentasFiltradas = cuentasRes.data.filter(c => c.tipo !== 'EXTERNA');
            setCuentasPago(cuentasFiltradas);
            setListasPrecios(listasRes.data);
            setPromociones(promoRes.data);
            setHasOpenSession(!!sessionRes.data);

            const defaultLista = listasRes.data.find(l => l.es_default) || listasRes.data[0];
            if (defaultLista) setSelectedLista(defaultLista.id);

            const cajaOperativa = cuentasRes.data.find(c => c.es_caja_operativa) || cuentasRes.data[0];
            if (cajaOperativa) setSelectedCuenta(cajaOperativa.id);
        } catch (error) {
            alert('Error al cargar datos iniciales: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const loadProductos = async () => {
        try {
            const response = await api.get('/productos', {
                params: { activo: 'true', lista_id: selectedLista }
            });
            setProductos(response.data);
        } catch (error) {
            console.error('Error loading products:', error);
        }
    };

    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddToCart = (producto, esGranel = false) => {
        if (esGranel) {
            setSelectedProductForWeight(producto);
            setCustomWeight('');
            setShowWeightModal(true);
        } else {
            addToCart(producto, 1, false);
        }
    };

    const addToCart = (producto, cantidad, esGranel) => {
        const precio = esGranel ? parseFloat(producto.precio_venta_granel) : parseFloat(producto.precio_venta_unidad);

        if (precio <= 0) {
            alert('El producto no tiene precio configurado en esta lista');
            return;
        }

        const existingItem = cart.find(item =>
            item.producto_id === producto.id && item.es_granel === esGranel
        );

        if (existingItem) {
            setCart(cart.map(item =>
                item.producto_id === producto.id && item.es_granel === esGranel
                    ? { ...item, cantidad: item.cantidad + parseFloat(cantidad) }
                    : item
            ));
        } else {
            setCart([...cart, {
                producto_id: producto.id,
                nombre: producto.nombre,
                cantidad: parseFloat(cantidad),
                precio_venta: precio,
                fabricante: producto.fabricante || '',
                marca: producto.marca || '',
                es_granel: esGranel
            }]);
        }
        setShowWeightModal(false);
    };

    const updateQuantity = (index, cantidad) => {
        if (cantidad < 0) return;
        if (cantidad === 0) {
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
        const subtotal = cart.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);
        const discount = calculateTotalDiscount();
        return Math.max(0, subtotal - discount);
    };

    const getSubtotal = () => {
        return cart.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);
    };

    const calculateTotalDiscount = () => {
        let totalDiscount = 0;
        
        appliedPromociones.forEach(promo => {
            if (promo.ambito_aplicacion === 'carrito') {
                // Cart-wide discount
                const subtotal = getSubtotal();
                if (promo.tipo === 'porcentaje') {
                    totalDiscount += subtotal * (promo.valor_descuento / 100);
                } else if (promo.tipo === 'precio_fijo') {
                    totalDiscount += promo.valor_descuento;
                }
            } else {
                // Product-specific discounts are applied per item
                cart.forEach(item => {
                    if (shouldApplyPromoToItem(promo, item)) {
                        const itemSubtotal = item.cantidad * item.precio_venta;
                        if (promo.tipo === 'porcentaje') {
                            totalDiscount += itemSubtotal * (promo.valor_descuento / 100);
                        } else if (promo.tipo === 'b2g' && item.cantidad >= promo.cantidad_minima) {
                            // Buy 2 get X% off - apply to second item
                            const itemsToDiscount = Math.floor(item.cantidad / 2);
                            totalDiscount += itemsToDiscount * item.precio_venta * (promo.valor_descuento / 100);
                        } else if (promo.tipo === 'precio_fijo') {
                            totalDiscount += promo.valor_descuento;
                        }
                    }
                });
            }
        });
        
        return totalDiscount;
    };

    const shouldApplyPromoToItem = (promo, item) => {
        // Debug logging
        console.log('[Promo] shouldApplyPromoToItem:', {
            promoId: promo.id,
            promoNombre: promo.nombre,
            promoAmbito: promo.ambito_aplicacion,
            promoEntidadId: promo.entidad_id,
            promoMarca: promo.marca_nombre,
            promoFabricante: promo.fabricante_nombre,
            itemId: item.producto_id,
            itemMarca: item.marca,
            itemFabricante: item.fabricante
        });
        
        // Carrito-wide promotions always apply
        if (promo.ambito_aplicacion === 'carrito') return true;
        
        // Producto específico
        if (promo.ambito_aplicacion === 'producto') {
            const match = promo.entidad_id === item.producto_id;
            console.log('[Promo] Producto match:', match, promo.entidad_id, '===', item.producto_id);
            return match;
        }
        
        // Marca
        if (promo.ambito_aplicacion === 'marca') {
            const promoMarca = promo.marca_nombre || promo.entidad_nombre;
            if (promoMarca && item.marca) {
                const match = promoMarca.toLowerCase() === item.marca.toLowerCase();
                console.log('[Promo] Marca match:', match, promoMarca, '===', item.marca);
                return match;
            }
            console.log('[Promo] Marca no coincide: promoMarca=', promoMarca, 'item.marca=', item.marca);
        }
        
        // Fabricante
        if (promo.ambito_aplicacion === 'fabricante') {
            const promoFabricante = promo.fabricante_nombre || promo.entidad_nombre;
            if (promoFabricante && item.fabricante) {
                const match = promoFabricante.toLowerCase() === item.fabricante.toLowerCase();
                console.log('[Promo] Fabricante match:', match, promoFabricante, '===', item.fabricante);
                return match;
            }
        }
        
        console.log('[Promo] No aplicó:', promo.ambito_aplicacion);
        return false;
    };

    const getItemDiscount = (item) => {
        let discount = 0;
        
        appliedPromociones.forEach(promo => {
            if (shouldApplyPromoToItem(promo, item)) {
                const itemSubtotal = item.cantidad * item.precio_venta;
                if (promo.tipo === 'porcentaje') {
                    discount += itemSubtotal * (promo.valor_descuento / 100);
                } else if (promo.tipo === 'b2g' && item.cantidad >= promo.cantidad_minima) {
                    const itemsToDiscount = Math.floor(item.cantidad / 2);
                    discount += itemsToDiscount * item.precio_venta * (promo.valor_descuento / 100);
                } else if (promo.tipo === 'precio_fijo') {
                    discount += promo.valor_descuento;
                }
            }
        });
        
        return discount;
    };

    const getAmbitoLabel = (promo) => {
        const labels = {
            'producto': promo.producto_nombre || 'Producto específico',
            'categoria': promo.categoria_nombre || 'Categoría',
            'marca': promo.marca_nombre || promo.entidad_nombre || 'Marca',
            'fabricante': promo.fabricante_nombre || promo.entidad_nombre || 'Fabricante',
            'carrito': 'Carrito completo',
            'cliente': 'Cliente específico'
        };
        return labels[promo.ambito_aplicacion] || promo.ambito_aplicacion;
    };

    const handleSale = async () => {
        if (cart.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        if (!selectedCuenta) {
            alert('Debe seleccionar una forma de pago');
            return;
        }

        setProcessingSale(true);

        try {
            const isCuentaCorriente = selectedCuenta === 'CUENTA_CORRIENTE';
            const saleData = {
                cliente_id: selectedCliente || null,
                lista_precio_id: parseInt(selectedLista),
                descuento_total: calculateTotalDiscount(),
                items: cart.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    precio_venta: item.precio_venta,
                    es_granel: item.es_granel
                })),
                cuenta_pago_id: isCuentaCorriente ? null : parseInt(selectedCuenta),
                tipo_venta: isCuentaCorriente ? 'CUENTA_CORRIENTE' : 'CONTADO',
                promociones_aplicadas: appliedPromociones.map(p => ({
                    promocion_id: p.id,
                    descuento_aplicado: p.ambito_aplicacion === 'carrito' 
                        ? calculateTotalDiscount() 
                        : cart.reduce((sum, item) => sum + getItemDiscount(item), 0)
                }))
    };

            await api.post('/ventas', saleData);

            alert('Venta registrada exitosamente');
            setCart([]);
            setAppliedPromociones([]);
            setSelectedCliente('');
            // Reset payment to default cash account
            const cajaOperativa = cuentasPago.find(c => c.es_caja_operativa) || cuentasPago[0];
            if (cajaOperativa) setSelectedCuenta(cajaOperativa.id);
            loadProductos();
        } catch (error) {
            alert('Error al procesar venta: ' + (error.response?.data?.error || error.message));
        } finally {
            setProcessingSale(false);
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
        <div className="pos-container">
            {!hasOpenSession && (
                <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 1000 }}>
                    <div className="card text-center p-xl" style={{ maxWidth: '400px' }}>
                        <div className="text-6xl mb-md">🔒</div>
                        <h2>Caja Cerrada</h2>
                        <p className="mb-lg">Debe realizar la apertura de caja antes de poder realizar ventas en el POS.</p>
                        <a href="/caja" className="btn btn-primary w-full">Ir a Gestión de Caja</a>
                    </div>
                </div>
            )}

            {/* Quick Weight Selector Modal */}
            {showWeightModal && selectedProductForWeight && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <h3>Seleccionar Peso: {selectedProductForWeight.nombre}</h3>
                        <p className="text-muted mb-lg">Elija una opción rápida o ingrese el peso exacto</p>

                        <div className="grid grid-cols-3 gap-sm mb-lg">
                            {[0.25, 0.5, 1, 1.5, 2, 3, 5, 10, 15].map(weight => (
                                <button
                                    key={weight}
                                    className="btn btn-outline"
                                    onClick={() => addToCart(selectedProductForWeight, weight, true)}
                                >
                                    {weight}kg
                                </button>
                            ))}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Otro peso (kg)</label>
                            <div className="flex gap-sm">
                                <input
                                    type="number"
                                    className="form-input"
                                    value={customWeight}
                                    onChange={(e) => setCustomWeight(e.target.value)}
                                    placeholder="0.0"
                                    min="0.1"
                                    step="0.1"
                                    autoFocus
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={() => customWeight && addToCart(selectedProductForWeight, customWeight, true)}
                                    disabled={!customWeight}
                                >
                                    OK
                                </button>
                            </div>
                        </div>

                        <div className="mt-lg">
                            <button className="btn btn-outline w-full" onClick={() => setShowWeightModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="pos-products">
                <div className="pos-header">
                    <h2>Productos</h2>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                        <select
                            className="form-select"
                            value={selectedLista}
                            onChange={(e) => setSelectedLista(e.target.value)}
                            style={{ width: '200px' }}
                        >
                            {listasPrecios.map(lista => (
                                <option key={lista.id} value={lista.id}>
                                    {lista.nombre} {lista.es_default && '(Predet.)'}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ flex: 1 }}
                        />
                    </div>
                </div>

                <div className="products-grid">
                    {filteredProductos.map(producto => (
                        <div key={producto.id} className="product-card">
                            <div style={{ 
                                fontWeight: 'bold', 
                                fontSize: '15px', 
                                color: 'var(--color-primary)',
                                marginBottom: '4px'
                            }}>
                                {producto.marca ? producto.marca.toUpperCase() : ''}
                            </div>
                            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                                {producto.nombre}
                            </div>
                            <div className="product-info" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                <span className="badge badge-info" style={{ marginRight: '8px' }}>{producto.tipo_presentacion}</span>
                                <span>Stock: {parseFloat(producto.stock_actual).toFixed(2)}</span>
                            </div>
                            <div className="product-prices" style={{ marginBottom: '12px' }}>
                                <div>
                                    <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unidad</small>
                                    <strong>${parseFloat(producto.precio_venta_unidad || 0).toFixed(2)}</strong>
                                </div>
                                {producto.tipo_presentacion === 'BOLSA' && (
                                    <div>
                                        <small style={{ fontSize: '11px', color: 'var(--color-success)' }}>Granel</small>
                                        <strong style={{ color: 'var(--color-success)' }}>${parseFloat(producto.precio_venta_granel || 0).toFixed(2)}</strong>
                                    </div>
                                )}
                            </div>
                            <div className="product-actions">
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleAddToCart(producto, false)}
                                    disabled={producto.stock_actual <= 0}
                                >
                                    + Unidad
                                </button>
                                {producto.tipo_presentacion === 'BOLSA' && (
                                    <button
                                        className="btn btn-sm btn-success"
                                        onClick={() => handleAddToCart(producto, true)}
                                    >
                                        + Granel
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pos-cart">
                <div className="cart-header">
                    <h2>Carrito</h2>
                    {cart.length > 0 && (
                        <button className="btn btn-sm btn-outline" onClick={() => setCart([])}>
                            Limpiar
                        </button>
                    )}
                </div>

                <div className="cart-items">
                    {cart.length === 0 ? (
                        <p className="text-center text-muted" style={{ padding: '2rem' }}>
                            Carrito vacío
                        </p>
                    ) : (
                        cart.map((item, index) => (
                            <div key={index} className="cart-item">
                                <div className="cart-item-info">
                                    <strong style={{ fontSize: '14px', color: 'var(--color-primary)' }}>{item.marca ? item.marca.toUpperCase() : ''}</strong>
                                    <div style={{ fontSize: '13px' }}>{item.nombre}</div>
                                    <span className="badge badge-info" style={{ fontSize: '10px', marginTop: '4px' }}>
                                        {item.es_granel ? 'Granel' : 'Unidad'}
                                    </span>
                                </div>
                                <div className="cart-item-controls">
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ width: '80px' }}
                                        value={item.cantidad}
                                        onChange={(e) => updateQuantity(index, e.target.value)}
                                        min={item.es_granel ? "0.1" : "1"}
                                        step={item.es_granel ? "0.1" : "1"}
                                    />
                                    <span>× ${item.precio_venta.toFixed(2)}</span>
                                    <strong>${(item.cantidad * item.precio_venta).toFixed(2)}</strong>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => removeFromCart(index)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="cart-footer">
                    <div className="form-group">
                        <label className="form-label">Cliente (Opcional)</label>
                        <select
                            className="form-select"
                            value={selectedCliente}
                            onChange={(e) => setSelectedCliente(e.target.value)}
                        >
                            <option value="">Mostrador</option>
                            {clientes.map(cliente => (
                                <option key={cliente.id} value={cliente.id}>
                                    {cliente.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Promociones</label>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Selecciona las promociones a aplicar
                        </div>
                        <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                            {promociones.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    No hay promociones activas
                                </div>
                            ) : (
                                promociones.map(promo => {
                                    const isApplied = appliedPromociones.some(p => p.id === promo.id);
                                    return (
                                        <label key={promo.id} style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            background: isApplied ? 'var(--color-success-light)' : 'transparent',
                                            borderRadius: '4px',
                                            marginBottom: '2px'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={isApplied}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAppliedPromociones([...appliedPromociones, promo]);
                                                    } else {
                                                        setAppliedPromociones(appliedPromociones.filter(p => p.id !== promo.id));
                                                    }
                                                }}
                                                style={{ marginRight: '8px' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: '500' }}>
                                                    {promo.nombre}
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    {promo.tipo === 'porcentaje' ? `${promo.valor_descuento}%` : `${promo.valor_descuento}`} 
                                                    - {getAmbitoLabel(promo)}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Forma de Pago</label>
                        <select
                            className="form-select"
                            value={selectedCuenta}
                            onChange={(e) => setSelectedCuenta(e.target.value)}
                            required
                        >
                            {cuentasPago.map(cuenta => (
                                <option key={cuenta.id} value={cuenta.id}>
                                    {cuenta.nombre}
                                </option>
                            ))}
                            {/* If a client is selected, allow charging to Cuenta Corriente */}
                            {selectedCliente && (
                                <option value="CUENTA_CORRIENTE">Cuenta Corriente</option>
                            )}
                        </select>
                    </div>

                    <div className="cart-total">
                        <span>TOTAL:</span>
                        <strong>${getTotal().toFixed(2)}</strong>
                    </div>

                    {/* Promociones aplicadas */}
                    {appliedPromociones.length > 0 && (
                        <div className="applied-promotions" style={{ 
                            background: 'var(--color-success-light)', 
                            borderRadius: 'var(--border-radius)',
                            padding: 'var(--spacing-md)',
                            marginTop: 'var(--spacing-md)'
                        }}>
                            <h4 style={{ margin: '0 0 var(--spacing-sm)', color: 'var(--color-success)', fontSize: '13px' }}>
                                🎉 Promociones Aplicadas
                            </h4>
                            {appliedPromociones.map(promo => (
                                <div key={promo.id} style={{ 
                                    fontSize: '12px', 
                                    color: 'var(--color-success)',
                                    marginBottom: '4px'
                                }}>
                                    ✓ {promo.nombre} 
                                    ({promo.tipo === 'porcentaje' ? `${promo.valor_descuento}%` : `${promo.valor_descuento}`})
                                </div>
                            ))}
                            <div style={{ 
                                fontSize: '12px', 
                                fontWeight: 'bold',
                                color: 'var(--color-success)',
                                marginTop: 'var(--spacing-sm)',
                                borderTop: '1px solid var(--color-success)',
                                paddingTop: '4px'
                            }}>
                                Descuento: -${calculateTotalDiscount().toFixed(2)}
                            </div>
                        </div>
                    )}

                    {/* Descuentos por ítem */}
                    {cart.some(item => getItemDiscount(item) > 0) && (
                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                            <h5 style={{ fontSize: '12px', marginBottom: '4px' }}>Descuentos por producto:</h5>
                            {cart.filter(item => getItemDiscount(item) > 0).map((item, idx) => (
                                <div key={idx} style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--color-success)',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span>{item.nombre.substring(0, 20)}...</span>
                                    <span>-${getItemDiscount(item).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        className="btn btn-primary btn-lg w-full"
                        onClick={handleSale}
                        disabled={cart.length === 0 || processingSale}
                    >
                        {processingSale ? 'Procesando...' : 'Finalizar Venta'}
                    </button>
                </div>
            </div>
        </div>
    );
}
