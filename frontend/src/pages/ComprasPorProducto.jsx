import { useEffect, useState } from 'react';
import api from '../api';

export default function ComprasPorProducto() {
    const [productos, setProductos] = useState([]);
    const [compras, setCompras] = useState([]);
    const [selectedProducto, setSelectedProducto] = useState('');
    const [loading, setLoading] = useState(true);
    const [detalle, setDetalle] = useState(null);

    useEffect(() => {
        loadProductos();
        loadCompras();
    }, []);

    // Ensure compras include items when a product is selected
    useEffect(() => {
        if (!selectedProducto) return;
        // For compras without items, fetch details in parallel
        const loadMissingDetails = async () => {
            const updated = await Promise.all(compras.map(async (c) => {
                if (c.items && c.items.length > 0) return c;
                try {
                    const res = await api.get(`/compras/${c.id}`);
                    return res.data;
                } catch (e) {
                    return c;
                }
            }));
            setCompras(updated);
        };

        loadMissingDetails();
    }, [selectedProducto]);

    const loadProductos = async () => {
        try {
            const res = await api.get('/productos', { params: { activo: 'true' } });
            setProductos(res.data);
        } catch (e) { console.error(e); }
    };

    const loadCompras = async () => {
        try {
            setLoading(true);
            const res = await api.get('/compras');
            setCompras(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = selectedProducto ? compras.filter(c => (c.items || []).some(i => i.producto_id?.toString() === selectedProducto)) : [];

    const verDetalle = async (id) => {
        try {
            const res = await api.get(`/compras/${id}`);
            setDetalle(res.data);
        } catch (e) { console.error(e); }
    };

    return (
        <div className="container" style={{ padding: '1.5rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Compras por Producto</h1>
                    <p className="text-secondary">Seleccione un producto para ver sus compras</p>
                </div>
            </div>

            <div className="card mb-lg p-md">
                <div className="grid-1">
                    <select className="form-input" value={selectedProducto} onChange={e => setSelectedProducto(e.target.value)}>
                        <option value="">Seleccione producto...</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo || ''})</option>)}
                    </select>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr><th>Fecha</th><th>Factura</th><th>Proveedor</th><th>Linea</th><th>Cantidad</th><th>Precio</th></tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center">Cargando...</td></tr>
                            ) : selectedProducto === '' ? (
                                <tr><td colSpan="6" className="text-center">Seleccione un producto</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="6" className="text-center">No se encontraron compras para este producto</td></tr>
                            ) : filtered.map(c => (
                                (c.items || []).filter(i => i.producto_id?.toString() === selectedProducto).map(it => (
                                    <tr key={`${c.id}-${it.id || Math.random()}`}>
                                        <td>{new Date(c.fecha).toLocaleDateString()}</td>
                                        <td>{c.numero_factura || `ID:${c.id}`}</td>
                                        <td>{c.proveedor_nombre}</td>
                                        <td>{it.producto_nombre || it.descripcion}</td>
                                        <td>{it.cantidad}</td>
                                        <td>${parseFloat(it.precio_costo).toFixed(2)}</td>
                                        <td>
                                            <button className="btn btn-sm btn-outline" onClick={() => verDetalle(c.id)}>Ver</button>
                                        </td>
                                    </tr>
                                ))
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {detalle && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '900px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3>Detalle {detalle.numero_factura || detalle.id}</h3>
                            <button className="btn btn-sm" onClick={() => setDetalle(null)}>✕</button>
                        </div>
                        <div className="table-container mb-md">
                            <table>
                                <thead>
                                    <tr><th>Producto/Detalle</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
                                </thead>
                                <tbody>
                                    {detalle.items.map(it => (
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
                            <button className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
