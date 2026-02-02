import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function StockAjuste() {
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [filteredProductos, setFilteredProductos] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [tipoMovimiento, setTipoMovimiento] = useState('APERTURA_BOLSA'); // APERTURA_BOLSA | ENTRADA | SALIDA
    const [form, setForm] = useState({ producto_id: '', cantidad: '', notas: '' });
    const [loading, setLoading] = useState(false);

    // Obtener el producto seleccionado para determinar su tipo
    const selectedProducto = productos.find(p => p.id.toString() === form.producto_id);

    // Filter products by search term
    useEffect(() => {
        if (productSearch.trim() === '') {
            setFilteredProductos(productos);
        } else {
            const searchLower = productSearch.toLowerCase();
            setFilteredProductos(productos.filter(p =>
                p.nombre.toLowerCase().includes(searchLower) ||
                (p.marca && p.marca.toLowerCase().includes(searchLower)) ||
                (p.codigo && p.codigo.toLowerCase().includes(searchLower))
            ));
        }
    }, [productSearch, productos]);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/productos');
                setProductos(res.data);
                setFilteredProductos(res.data);
            } catch (err) {
                console.error(err);
            }
        })();
    }, []);

    const handleSubmit = async () => {
        try {
            if (!form.producto_id) return alert('Producto requerido');

            // Para APERTURA_BOLSA: cantidad=1, tipo=SALIDA
            let tipo = 'SALIDA';
            let cantidad = 1;
            let motivo = 'APERTURA_BOLSA';

            if (tipoMovimiento === 'ENTRADA') {
                if (!form.cantidad) return alert('Cantidad requerida para entrada');
                tipo = 'ENTRADA';
                cantidad = parseFloat(form.cantidad);
                motivo = 'COMPRA';
            } else if (tipoMovimiento === 'SALIDA') {
                if (!form.cantidad) return alert('Cantidad requerida para salida');
                tipo = 'SALIDA';
                cantidad = parseFloat(form.cantidad);
                motivo = 'AJUSTE';
            }

            setLoading(true);
            await api.post('/stock-movimientos', {
                producto_id: parseInt(form.producto_id),
                tipo,
                cantidad,
                motivo,
                notas: form.notas || ''
            });
            alert('Movimiento registrado exitosamente');
            setForm({ producto_id: '', cantidad: '', notas: '' });
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Movimiento de Stock</h1>
                    <p className="text-secondary">Registrar entrada, salida o apertura de bolsa</p>
                </div>
            </div>

            {/* Selector de tipo de movimiento */}
            <div className="card p-md mb-md">
                <h3>Tipo de Movimiento</h3>
                <div className="flex gap-md mt-md">
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="APERTURA_BOLSA" 
                            checked={tipoMovimiento === 'APERTURA_BOLSA'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Apertura de Bolsa (SALIDA x1)</span>
                    </label>
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="ENTRADA" 
                            checked={tipoMovimiento === 'ENTRADA'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Entrada (Compra)</span>
                    </label>
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="SALIDA" 
                            checked={tipoMovimiento === 'SALIDA'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Salida (Ajuste)</span>
                    </label>
                </div>
            </div>

            {/* Formulario */}
            <div className="card p-md" style={{ maxWidth: 600 }}>
                <div className="grid grid-cols-1 gap-md">
                    <div>
                        <label className="form-label">Producto</label>
                        <input
                            type="text"
                            className="form-input w-full mb-sm"
                            placeholder="Buscar por nombre, marca o código..."
                            value={productSearch}
                            onChange={(e) => {
                                setProductSearch(e.target.value);
                                if (!e.target.value) {
                                    setForm({...form, producto_id: '', cantidad: ''});
                                }
                            }}
                        />
                        <div style={{ 
                            maxHeight: '200px', 
                            overflowY: 'auto', 
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px'
                        }}>
                            {filteredProductos.length === 0 ? (
                                <div className="p-md text-center text-muted">No se encontraron productos</div>
                            ) : (
                                filteredProductos.map(p => (
                                    <div 
                                        key={p.id}
                                        style={{ 
                                            padding: '8px 12px', 
                                            cursor: 'pointer',
                                            backgroundColor: form.producto_id === p.id.toString() ? '#22c55e' : 'var(--bg-hover)',
                                            color: form.producto_id === p.id.toString() ? '#fff' : 'inherit',
                                            borderBottom: '1px solid var(--border-color)',
                                            fontWeight: form.producto_id === p.id.toString() ? 'bold' : 'normal',
                                            boxShadow: form.producto_id === p.id.toString() ? 'inset 0 0 0 2px #166534' : 'none'
                                        }}
                                        onClick={() => setForm({...form, producto_id: p.id.toString(), cantidad: ''})}
                                    >
                                        <div style={{ fontWeight: 'bold' }}>{p.marca ? p.marca.toUpperCase() : ''}</div>
                                        <div style={{ fontSize: '13px' }}>{p.nombre}</div>
                                        <div style={{ fontSize: '11px', opacity: form.producto_id === p.id.toString() ? 0.8 : 0.6 }}>
                                            Stock: {p.stock_actual} [{p.tipo_presentacion}] {p.codigo && `- ${p.codigo}`}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {selectedProducto && (
                            <div style={{ 
                                marginTop: '12px',
                                marginBottom: '12px',
                                padding: '16px',
                                backgroundColor: '#dcfce7',
                                borderRadius: '8px',
                                border: '3px solid #22c55e'
                            }}>
                                <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '8px', fontSize: '14px' }}>
                                    ✓ PRODUCTO SELECCIONADO
                                </div>
                                <div style={{ fontSize: '16px', color: '#14532d', marginBottom: '6px' }}>
                                    <strong>{selectedProducto.nombre}</strong>
                                </div>
                                <div style={{ fontSize: '13px', color: '#166534' }}>
                                    <strong>Stock actual:</strong> {selectedProducto.stock_actual} unidades | {selectedProducto.tipo_presentacion}
                                </div>
                                <button 
                                    type="button"
                                    className="btn btn-sm"
                                    style={{ 
                                        marginTop: '10px',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 12px'
                                    }}
                                    onClick={() => {
                                        setForm({...form, producto_id: '', cantidad: ''});
                                        setProductSearch('');
                                    }}
                                >
                                    ✕ Quitar selección
                                </button>
                            </div>
                        )}
                    </div>

                    {tipoMovimiento !== 'APERTURA_BOLSA' && selectedProducto && (
                        <div>
                            <label className="form-label">Cantidad (en unidades enteras)</label>
                            <input 
                                className="form-input w-full" 
                                type="number" 
                                placeholder="Ej: 1, 2, 5"
                                value={form.cantidad} 
                                onChange={(e) => setForm({...form, cantidad: e.target.value})}
                                min="1"
                                step="1"
                            />
                            <small className="text-muted">
                                Ingrese números enteros (1, 2, 3...)
                            </small>
                        </div>
                    )}

                    {tipoMovimiento === 'APERTURA_BOLSA' && (
                        <div className="alert alert-info">
                            <strong>Apertura de Bolsa:</strong> Se descontará 1 unidad del stock automáticamente.
                        </div>
                    )}

                    <div>
                        <label className="form-label">Notas (opcional)</label>
                        <textarea 
                            className="form-input w-full" 
                            rows="3"
                            placeholder="Observaciones sobre el movimiento..."
                            value={form.notas}
                            onChange={(e) => setForm({...form, notas: e.target.value})}
                        />
                    </div>

                    <div className="flex gap-md">
                        <button 
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={loading || (tipoMovimiento !== 'APERTURA_BOLSA' && !form.cantidad)}
                        >
                            {loading ? 'Procesando...' : 'Registrar Movimiento'}
                        </button>
                        <button 
                            className="btn btn-outline"
                            onClick={() => navigate('/movimientos-stock')}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
