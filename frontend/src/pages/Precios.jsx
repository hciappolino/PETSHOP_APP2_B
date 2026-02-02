import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Precios() {
    const [listas, setListas] = useState([]);
    const [selectedLista, setSelectedLista] = useState(null);
    const [precios, setPrecios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingPrecios, setLoadingPrecios] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListData, setNewListData] = useState({ nombre: '', descripcion: '', margen_sugerido: 30, es_default: false });

    const { isAdmin, isGerente } = useAuth();
    const canEdit = isAdmin || isGerente;

    useEffect(() => {
        loadListas();
    }, []);

    const loadListas = async () => {
        try {
            setLoading(true);
            const response = await api.get('/listas-precios');
            setListas(response.data);
            if (response.data.length > 0 && !selectedLista) {
                handleSelectLista(response.data[0]);
            }
        } catch (error) {
            setError('Error al cargar listas: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectLista = async (lista) => {
        setSelectedLista(lista);
        setLoadingPrecios(true);
        try {
            const response = await api.get(`/precios/lista/${lista.id}`);
            let rows = response.data || [];

            // Para los productos que no tengan costo_ultima_compra, intentar obtener la última compra
            const missing = rows.filter(r => !r.costo_ultima_compra || parseFloat(r.costo_ultima_compra) === 0).map(r => r.id);
            if (missing.length > 0) {
                try {
                    const promises = missing.map(id => api.get(`/reportes/ultima-compra/${id}`).then(r => ({ id, data: r.data })).catch(() => ({ id, data: null })));
                    const results = await Promise.all(promises);
                    const mapLast = {};
                    results.forEach(r => { if (r?.data) mapLast[r.id] = r.data; });
                    rows = rows.map(r => {
                        if ((!r.costo_ultima_compra || parseFloat(r.costo_ultima_compra) === 0) && mapLast[r.id]?.precio_costo) {
                            return { ...r, costo_ultima_compra: mapLast[r.id].precio_costo };
                        }
                        return r;
                    });
                } catch (e) {
                    console.warn('No se pudo completar costos faltantes:', e);
                }
            }

            setPrecios(rows);
        } catch (error) {
            setError('Error al cargar precios: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoadingPrecios(false);
        }
    };

    const handleCreateList = async (e) => {
        e.preventDefault();
        try {
            await api.post('/listas-precios', newListData);
            setShowNewListModal(false);
            setNewListData({ nombre: '', descripcion: '', margen_sugerido: 30, es_default: false });
            loadListas();
            setSuccess('Lista de precios creada correctamente');
        } catch (error) {
            setError('Error al crear lista: ' + (error.response?.data?.error || error.message));
        }
    };

    const updatePrice = async (productoId, fields) => {
        try {
            const priceData = {
                lista_id: selectedLista.id,
                producto_id: productoId,
                ...fields
            };
            await api.post('/precios/actualizar', priceData);

            // Update local state
            setPrecios(precios.map(p =>
                p.id === productoId ? { ...p, ...fields, updated_at: new Date() } : p
            ));
        } catch (error) {
            setError('Error al actualizar precio: ' + (error.response?.data?.error || error.message));
        }
    };

    const calculateSuggested = (costo, margen) => {
        const m = (typeof margen === 'number' && !isNaN(margen)) ? margen : 0;
        const c = parseFloat(costo) || 0;
        return c * (1 + m / 100);
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Gestión de Precios</h1>
                    <p className="text-secondary">Administración de listas de precios y márgenes</p>
                </div>
                {canEdit && (
                    <button className="btn btn-primary" onClick={() => setShowNewListModal(true)}>
                        + Nueva Lista
                    </button>
                )}
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}
            {success && <div className="alert alert-success mb-md">{success}</div>}

            <div className="grid grid-cols-[300px_1fr] gap-lg">
                {/* Sidebar: Listas de Precios */}
                <div className="flex flex-col gap-md">
                    <h3>Listas Disponibles</h3>
                    {loading ? <div className="spinner"></div> : (
                        <div className="flex flex-col gap-sm">
                            {listas.map(lista => (
                                <div
                                    key={lista.id}
                                    className={`card p-md cursor-pointer border-l-4 ${selectedLista?.id === lista.id ? 'border-primary bg-primary-light/10' : 'border-transparent'}`}
                                    onClick={() => handleSelectLista(lista)}
                                >
                                    <div className="flex justify-between items-start">
                                        <strong>{lista.nombre}</strong>
                                        {lista.es_default && <span className="badge badge-info">Predet.</span>}
                                    </div>
                                    <p className="text-sm text-muted m-0">{lista.descripcion || 'Sin descripción'}</p>
                                    <p className="text-sm mt-sm">Margen: {lista.margen_sugerido}%</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Content: Precios de la Lista */}
                <div className="card">
                    {selectedLista ? (
                        <>
                            <div className="flex justify-between items-center mb-lg">
                                <div>
                                    <h3 className="m-0">Precios: {selectedLista.nombre}</h3>
                                    <p className="text-sm text-muted">Margen sugerido por la lista: {(selectedLista.margen_sugerido || 0)}%</p>
                                </div>
                                <div className="text-sm text-muted">
                                    Ult. actualización automática: Hoy
                                </div>
                            </div>

                            {loadingPrecios ? (
                                <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
                            ) : (
                                <>
                                    {/* Unidad: productos tipo UNIDAD (o no BOLSA) */}
                                    <h4>Productos - Unidad</h4>
                                    <div className="table-container mb-lg">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Producto</th>
                                                    <th>Precio Compra</th>
                                                    <th>Margen (%)</th>
                                                    <th>Precio Venta (U)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {precios.filter(p => p.tipo_presentacion !== 'BOLSA').map(p => {
                                                    const costo = parseFloat(p.costo_ultima_compra) || 0;
                                                    const precioU = parseFloat(p.precio_venta_unidad) || 0;
                                                    const margenCalc = costo > 0 ? ((precioU - costo) / costo) * 100 : (selectedLista.margen_sugerido || 0);
                                                    return (
                                                        <tr key={p.id}>
                                                            <td>
                                                                <div>{p.nombre}</div>
                                                                <code className="text-xs text-muted">{p.codigo}</code>
                                                            </td>
                                                            <td>${costo.toFixed(2)}</td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="form-input text-right py-1 w-[100px]"
                                                                    value={typeof p._margen === 'number' ? p._margen.toFixed(2) : margenCalc.toFixed(2)}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, _margen: val, precio_venta_unidad: calculateSuggested(x.costo_ultima_compra, val) } : x));
                                                                    }}
                                                                    onBlur={async (e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const nuevoPrecio = calculateSuggested(p.costo_ultima_compra, val);
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, _margen: val, precio_venta_unidad: nuevoPrecio } : x));
                                                                        await updatePrice(p.id, { precio_venta_unidad: parseFloat(nuevoPrecio) });
                                                                    }}
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="form-input text-right py-1 w-[120px]"
                                                                    value={(parseFloat(p.precio_venta_unidad) || 0).toFixed(2)}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, precio_venta_unidad: val } : x));
                                                                    }}
                                                                    onBlur={async (e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const newMargin = (parseFloat(p.costo_ultima_compra || 0) > 0) ? ((val - parseFloat(p.costo_ultima_compra || 0)) / parseFloat(p.costo_ultima_compra || 0)) * 100 : 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, precio_venta_unidad: val, _margen: newMargin } : x));
                                                                        await updatePrice(p.id, { precio_venta_unidad: parseFloat(val) });
                                                                    }}
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Bolsa: productos tipo BOLSA */}
                                    <h4>Productos - Bolsa</h4>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Producto</th>
                                                    <th>Precio Compra (Bolsa)</th>
                                                    <th>Margen Bolsa (%)</th>
                                                    <th>Precio Venta (Bolsa)</th>
                                                    <th>Margen Kilo (%)</th>
                                                    <th>Precio Venta (Kilo)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {precios.filter(p => p.tipo_presentacion === 'BOLSA').map(p => {
                                                    const costoBolsa = parseFloat(p.costo_ultima_compra) || 0;
                                                    const factor = parseFloat(p.factor_conversion) || 1;
                                                    const costoKilo = factor > 0 ? costoBolsa / factor : 0;
                                                    const precioBolsa = parseFloat(p.precio_venta_unidad) || 0;
                                                    const precioKilo = parseFloat(p.precio_venta_granel) || 0;
                                                    const margenBolsaCalc = costoBolsa > 0 ? ((precioBolsa - costoBolsa) / costoBolsa) * 100 : (selectedLista.margen_sugerido || 0);
                                                    const margenKiloCalc = costoKilo > 0 ? ((precioKilo - costoKilo) / costoKilo) * 100 : (selectedLista.margen_sugerido || 0);
                                                    return (
                                                        <tr key={p.id}>
                                                            <td>
                                                                <div>{p.nombre}</div>
                                                                <code className="text-xs text-muted">{p.codigo} • {p.factor_conversion}u</code>
                                                            </td>
                                                            <td>${costoBolsa.toFixed(2)}</td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    className="form-input text-right py-1 w-[100px]"
                                                                    value={typeof p._margen_bolsa === 'number' ? String(Math.round(p._margen_bolsa)) : String(Math.round(margenBolsaCalc))}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, _margen_bolsa: val, precio_venta_unidad: calculateSuggested(x.costo_ultima_compra, typeof val === 'number' ? val : 0) } : x));
                                                                    }}
                                                                    onBlur={async (e) => {
                                                                        const raw = parseFloat(e.target.value) || 0;
                                                                        const rounded = Math.round(raw);
                                                                        const nuevoPrecio = calculateSuggested(p.costo_ultima_compra, rounded);
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, _margen_bolsa: rounded, precio_venta_unidad: nuevoPrecio } : x));
                                                                        await updatePrice(p.id, { precio_venta_unidad: parseFloat(nuevoPrecio) });
                                                                    }}
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="form-input text-right py-1 w-[120px]"
                                                                    value={(parseFloat(p.precio_venta_unidad) || 0).toFixed(2)}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, precio_venta_unidad: val } : x));
                                                                    }}
                                                                    onBlur={async (e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const newMargin = (parseFloat(p.costo_ultima_compra || 0) > 0) ? ((val - parseFloat(p.costo_ultima_compra || 0)) / parseFloat(p.costo_ultima_compra || 0)) * 100 : 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, precio_venta_unidad: val, _margen_bolsa: newMargin } : x));
                                                                        await updatePrice(p.id, { precio_venta_unidad: parseFloat(val) });
                                                                    }}
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    className="form-input text-right py-1 w-[100px]"
                                                                    value={typeof p._margen_kilo === 'number' ? String(Math.round(p._margen_kilo)) : String(Math.round(margenKiloCalc))}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                                        const nuevoPrecioKilo = costoKilo * (1 + (typeof val === 'number' ? val : 0) / 100);
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, _margen_kilo: val, precio_venta_granel: nuevoPrecioKilo } : x));
                                                                    }}
                                                                    onBlur={async (e) => {
                                                                        const raw = parseFloat(e.target.value) || 0;
                                                                        const rounded = Math.round(raw);
                                                                        const nuevoPrecioKilo = costoKilo * (1 + rounded / 100);
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, _margen_kilo: rounded, precio_venta_granel: nuevoPrecioKilo } : x));
                                                                        await updatePrice(p.id, { precio_venta_granel: parseFloat(nuevoPrecioKilo) });
                                                                    }}
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="form-input text-right py-1 w-[120px]"
                                                                    value={(parseFloat(p.precio_venta_granel) || 0).toFixed(2)}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, precio_venta_granel: val } : x));
                                                                    }}
                                                                    onBlur={async (e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const newMarginKilo = costoKilo > 0 ? ((val - costoKilo) / costoKilo) * 100 : 0;
                                                                        setPrecios(precios.map(x => x.id === p.id ? { ...x, precio_venta_granel: val, _margen_kilo: newMarginKilo } : x));
                                                                        await updatePrice(p.id, { precio_venta_granel: parseFloat(val) });
                                                                    }}
                                                                    disabled={!canEdit}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="text-center p-xl text-muted">Seleccione una lista de precios para comenzar</div>
                    )}
                </div>
            </div>

            {/* Modal de Nueva Lista */}
            {showNewListModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Nueva Lista de Precios</h3>
                        <form onSubmit={handleCreateList}>
                            <div className="form-group">
                                <label className="form-label">Nombre de la Lista</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={newListData.nombre}
                                    onChange={(e) => setNewListData({ ...newListData, nombre: e.target.value })}
                                    placeholder="Ej: Minorista, Mayorista, AMBA..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newListData.descripcion}
                                    onChange={(e) => setNewListData({ ...newListData, descripcion: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Margen Sugerido (%)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    required
                                    value={newListData.margen_sugerido}
                                    onChange={(e) => setNewListData({ ...newListData, margen_sugerido: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="flex items-center gap-sm mb-lg">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={newListData.es_default}
                                    onChange={(e) => setNewListData({ ...newListData, es_default: e.target.checked })}
                                />
                                <label htmlFor="isDefault">Establecer como predeterminada</label>
                            </div>
                            <div className="flex justify-end gap-md">
                                <button type="button" className="btn btn-outline" onClick={() => setShowNewListModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>Crear Lista</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
