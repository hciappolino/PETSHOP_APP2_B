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
    const [editingRows, setEditingRows] = useState({});
    const [savingRows, setSavingRows] = useState({});
    const [viewMode, setViewMode] = useState('unidad'); // 'unidad' | 'bolsa'
    const [searchQuery, setSearchQuery] = useState('');

    const { hasPermission } = useAuth();
    const canEdit = hasPermission('precios.editar');

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
        setEditingRows({});
        setSavingRows({});
        setSearchQuery('');
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
        return Math.round(c * (1 + m / 100));
    };

    const removeRowDraft = (productoId) => {
        setEditingRows(prev => {
            const next = { ...prev };
            delete next[productoId];
            return next;
        });
    };

    const startEditUnidad = (p, margenCalc) => {
        setEditingRows(prev => ({
            ...prev,
            [p.id]: {
                precio_venta_unidad: Math.round(parseFloat(p.precio_venta_unidad) || 0),
                margen_unidad: Math.round(margenCalc)
            }
        }));
    };

    const startEditBolsa = (p, margenBolsaCalc, margenKiloCalc) => {
        setEditingRows(prev => ({
            ...prev,
            [p.id]: {
                precio_venta_unidad: Math.round(parseFloat(p.precio_venta_unidad) || 0),
                precio_venta_granel: Math.round(parseFloat(p.precio_venta_granel) || 0),
                margen_bolsa: Math.round(margenBolsaCalc),
                margen_kilo: Math.round(margenKiloCalc)
            }
        }));
    };

    const confirmEditUnidad = async (productoId) => {
        const draft = editingRows[productoId];
        if (!draft) return;
        setSavingRows(prev => ({ ...prev, [productoId]: true }));
        try {
            await updatePrice(productoId, { precio_venta_unidad: draft.precio_venta_unidad });
            removeRowDraft(productoId);
            setSuccess('Precio actualizado');
        } finally {
            setSavingRows(prev => ({ ...prev, [productoId]: false }));
        }
    };

    const confirmEditBolsa = async (productoId) => {
        const draft = editingRows[productoId];
        if (!draft) return;
        setSavingRows(prev => ({ ...prev, [productoId]: true }));
        try {
            await updatePrice(productoId, {
                precio_venta_unidad: draft.precio_venta_unidad,
                precio_venta_granel: draft.precio_venta_granel
            });
            removeRowDraft(productoId);
            setSuccess('Precios actualizados');
        } finally {
            setSavingRows(prev => ({ ...prev, [productoId]: false }));
        }
    };

    const formatPrice = (price) => Math.round(price).toLocaleString('es-AR');
    const getFactorKg = (producto) => {
        const direct = parseFloat(producto?.factor_conversion);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const source = `${producto?.nombre || ''} ${producto?.codigo || ''}`;
        const match = source.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
        if (match) {
            const parsed = parseFloat(match[1].replace(',', '.'));
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return 0;
    };

    const normalize = (value) => `${value || ''}`.trim().toLowerCase();
    const matchesFilters = (p) => {
        const nombre = normalize(p.nombre);
        const marca = normalize(p.marca);
        const codigo = normalize(p.codigo);
        const filtro = normalize(searchQuery);
        if (!filtro) return true;
        return nombre.includes(filtro) || marca.includes(filtro) || codigo.includes(filtro);
    };

    const preciosUnidad = precios.filter(p => p.tipo_presentacion !== 'BOLSA' && matchesFilters(p));
    const preciosBolsa = precios.filter(p => p.tipo_presentacion === 'BOLSA' && matchesFilters(p));

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
                                </div>`r`n                            </div>

                            {loadingPrecios ? (
                                <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-sm mb-md" style={{ flexWrap: 'wrap' }}>
                                        <button
                                            className={`btn ${viewMode === 'unidad' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => setViewMode('unidad')}
                                        >
                                            Ver por Unidad
                                        </button>
                                        <button
                                            className={`btn ${viewMode === 'bolsa' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => setViewMode('bolsa')}
                                        >
                                            Ver por Bolsa
                                        </button>
                                    </div>

                                    <div className="mb-md">
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Buscar por marca, producto o codigo"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    {viewMode === 'unidad' && (
                                    <>
                                    {/* Unidad: productos tipo UNIDAD (o no BOLSA) */}
                                    <h4>Productos - Unidad</h4>
                                    <div className="table-container mb-lg">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Marca</th>
                                                    <th>Producto</th>
                                                    <th>Precio Compra</th>
                                                    <th>Margen (%)</th>
                                                    <th>Precio Venta (U)</th>
                                                    {canEdit && <th>Acciones</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preciosUnidad.map(p => {
                                                    const costo = parseFloat(p.costo_ultima_compra) || 0;
                                                    const precioU = parseFloat(p.precio_venta_unidad) || 0;
                                                    const margenCalc = costo > 0 ? ((precioU - costo) / costo) * 100 : (selectedLista.margen_sugerido || 0);
                                                    const draft = editingRows[p.id];
                                                    const isEditingRow = !!draft;
                                                    return (
                                                        <tr key={p.id}>
                                                            <td>{p.marca || '-'}</td>
                                                            <td>
                                                                <div>{p.nombre}</div>
                                                                <code className="text-xs text-muted">{p.codigo}</code>
                                                            </td>
                                                            <td>${formatPrice(costo)}</td>
                                                            <td>
                                                                {isEditingRow ? (
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        className="form-input text-right py-1 w-[100px]"
                                                                        value={draft.margen_unidad}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const nuevoPrecio = calculateSuggested(p.costo_ultima_compra, val);
                                                                            setEditingRows(prev => ({
                                                                                ...prev,
                                                                                [p.id]: { ...prev[p.id], margen_unidad: val, precio_venta_unidad: nuevoPrecio }
                                                                            }));
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span>{Math.round(margenCalc)}%</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {isEditingRow ? (
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        className="form-input text-right py-1 w-[120px]"
                                                                        value={draft.precio_venta_unidad}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const newMargin = costo > 0 ? ((val - costo) / costo) * 100 : 0;
                                                                            setEditingRows(prev => ({
                                                                                ...prev,
                                                                                [p.id]: { ...prev[p.id], precio_venta_unidad: val, margen_unidad: newMargin }
                                                                            }));
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span>${formatPrice(p.precio_venta_unidad)}</span>
                                                                )}
                                                            </td>
                                                            {canEdit && (
                                                                <td>
                                                                    {isEditingRow ? (
                                                                        <div className="flex gap-sm">
                                                                            <button
                                                                                className="btn btn-success btn-sm"
                                                                                onClick={() => confirmEditUnidad(p.id)}
                                                                                disabled={!!savingRows[p.id]}
                                                                            >
                                                                                ✓
                                                                            </button>
                                                                            <button
                                                                                className="btn btn-outline btn-sm"
                                                                                onClick={() => removeRowDraft(p.id)}
                                                                                disabled={!!savingRows[p.id]}
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            className="btn btn-outline btn-sm"
                                                                            onClick={() => startEditUnidad(p, margenCalc)}
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    </>
                                    )}

                                    {viewMode === 'bolsa' && (
                                    <>
                                    {/* Bolsa: productos tipo BOLSA */}
                                    <h4>Productos - Bolsa</h4>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Marca</th>
                                                    <th>Producto</th>
                                                    <th>Precio Compra (Bolsa)</th>
                                                    <th>Margen (%)</th>
                                                    <th>Precio Venta (Bolsa)</th>
                                                    <th>Costo x Kilo</th>
                                                    <th>Margen (%)</th>
                                                    <th>Precio Venta (Kilo)</th>
                                                    {canEdit && <th>Acciones</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preciosBolsa.map(p => {
                                                    const costoBolsa = parseFloat(p.costo_ultima_compra) || 0;
                                                    const factor = getFactorKg(p);
                                                    const costoKilo = factor > 0 ? costoBolsa / factor : 0;
                                                    const precioBolsa = parseFloat(p.precio_venta_unidad) || 0;
                                                    const precioKilo = parseFloat(p.precio_venta_granel) || 0;
                                                    const margenBolsaCalc = costoBolsa > 0 ? ((precioBolsa - costoBolsa) / costoBolsa) * 100 : (selectedLista.margen_sugerido || 0);
                                                    const margenKiloCalc = costoKilo > 0 ? ((precioKilo - costoKilo) / costoKilo) * 100 : (selectedLista.margen_sugerido || 0);
                                                    const draft = editingRows[p.id];
                                                    const isEditingRow = !!draft;
                                                    return (
                                                        <tr key={p.id}>
                                                            <td>{p.marca || '-'}</td>
                                                            <td>
                                                                <div>{p.nombre}</div>
                                                                <code className="text-xs text-muted">{p.codigo} • {factor}kg</code>
                                                            </td>
                                                            <td>${formatPrice(costoBolsa)}</td>
                                                            {/* Margen Bolsa */}
                                                            <td>
                                                                {isEditingRow ? (
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        className="form-input text-right py-1 w-[80px]"
                                                                        value={draft.margen_bolsa}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const nuevoPrecio = Math.round(costoBolsa * (1 + val / 100));
                                                                            setEditingRows(prev => ({
                                                                                ...prev,
                                                                                [p.id]: { ...prev[p.id], margen_bolsa: val, precio_venta_unidad: nuevoPrecio }
                                                                            }));
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm">{Math.round(margenBolsaCalc)}%</span>
                                                                )}
                                                            </td>
                                                            {/* Precio Bolsa */}
                                                            <td>
                                                                {isEditingRow ? (
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        className="form-input text-right py-1 w-[100px]"
                                                                        value={draft.precio_venta_unidad}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const newMargin = costoBolsa > 0 ? ((val - costoBolsa) / costoBolsa) * 100 : 0;
                                                                            setEditingRows(prev => ({
                                                                                ...prev,
                                                                                [p.id]: { ...prev[p.id], precio_venta_unidad: val, margen_bolsa: newMargin }
                                                                            }));
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span>${formatPrice(p.precio_venta_unidad)}</span>
                                                                )}
                                                            </td>
                                                            <td>${formatPrice(costoKilo)}</td>
                                                            {/* Margen Kilo */}
                                                            <td>
                                                                {isEditingRow ? (
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        className="form-input text-right py-1 w-[80px]"
                                                                        value={draft.margen_kilo}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const nuevoPrecioKilo = Math.round(costoKilo * (1 + val / 100));
                                                                            setEditingRows(prev => ({
                                                                                ...prev,
                                                                                [p.id]: { ...prev[p.id], margen_kilo: val, precio_venta_granel: nuevoPrecioKilo }
                                                                            }));
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm">{Math.round(margenKiloCalc)}%</span>
                                                                )}
                                                            </td>
                                                            {/* Precio Kilo */}
                                                            <td>
                                                                {isEditingRow ? (
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        className="form-input text-right py-1 w-[100px]"
                                                                        value={draft.precio_venta_granel}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const newMarginKilo = costoKilo > 0 ? ((val - costoKilo) / costoKilo) * 100 : 0;
                                                                            setEditingRows(prev => ({
                                                                                ...prev,
                                                                                [p.id]: { ...prev[p.id], precio_venta_granel: val, margen_kilo: newMarginKilo }
                                                                            }));
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span>${formatPrice(p.precio_venta_granel)}</span>
                                                                )}
                                                            </td>
                                                            {canEdit && (
                                                                <td>
                                                                    {isEditingRow ? (
                                                                        <div className="flex gap-sm">
                                                                            <button
                                                                                className="btn btn-success btn-sm"
                                                                                onClick={() => confirmEditBolsa(p.id)}
                                                                                disabled={!!savingRows[p.id]}
                                                                            >
                                                                                ✓
                                                                            </button>
                                                                            <button
                                                                                className="btn btn-outline btn-sm"
                                                                                onClick={() => removeRowDraft(p.id)}
                                                                                disabled={!!savingRows[p.id]}
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            className="btn btn-outline btn-sm"
                                                                            onClick={() => startEditBolsa(p, margenBolsaCalc, margenKiloCalc)}
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    </>
                                    )}
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

