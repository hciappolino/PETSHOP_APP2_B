import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function StockAjuste() {
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [tipoMovimiento, setTipoMovimiento] = useState('APERTURA_BOLSA'); // APERTURA_BOLSA | ENTRADA | SALIDA
    const [form, setForm] = useState({ producto_id: '', cantidad: '', notas: '' });
    const [loading, setLoading] = useState(false);

    // Obtener el producto seleccionado para determinar su tipo
    const selectedProducto = productos.find(p => p.id.toString() === form.producto_id);
    const esBolsa = selectedProducto?.tipo_presentacion === 'BOLSA';

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/productos');
                setProductos(res.data);
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
                        <select 
                            className="form-select w-full" 
                            value={form.producto_id} 
                            onChange={(e) => setForm({...form, producto_id: e.target.value, cantidad: ''})}
                        >
                            <option value="">Seleccionar producto</option>
                            {productos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre} ({p.codigo}) - Stock: {p.stock_actual} [{p.tipo_presentacion}]
                                </option>
                            ))}
                        </select>
                    </div>

                    {tipoMovimiento !== 'APERTURA_BOLSA' && selectedProducto && (
                        <div>
                            <label className="form-label">
                                Cantidad {esBolsa ? '(en kg - mínimo 0.1)' : '(en unidades)'}
                            </label>
                            <input 
                                className="form-input w-full" 
                                type="number" 
                                placeholder={esBolsa ? "Ej: 0.5, 1.0, 2.5" : "Ej: 1, 2, 5"}
                                value={form.cantidad} 
                                onChange={(e) => setForm({...form, cantidad: e.target.value})}
                                min={esBolsa ? "0.1" : "1"}
                                step={esBolsa ? "0.1" : "1"}
                            />
                            <small className="text-muted">
                                {esBolsa 
                                    ? 'Producto a granel - use decimales (0.1 en 0.1)' 
                                    : 'Producto por unidad - use números enteros'}
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
