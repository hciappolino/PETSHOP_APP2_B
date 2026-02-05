import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './Promociones.css';

export default function Promociones() {
    const [promociones, setPromociones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPromocion, setEditingPromocion] = useState(null);
    const [showStats, setShowStats] = useState(null);
    
    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        tipo: 'porcentaje',
        valor_descuento: 0,
        ambito_aplicacion: 'producto',
        entidad_id: '',
        cantidad_minima: 1,
        fecha_inicio: new Date().toISOString().slice(0, 16),
        fecha_fin: '',
        uso_maximo: '',
        prioridad: 0,
        stackeable: false
    });
    
    // Entity options
    const [entidades, setEntidades] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    
    const { isAdmin, isGerente } = useAuth();
    const canEdit = isAdmin || isGerente;

    useEffect(() => {
        loadPromociones();
        loadEntityOptions();
    }, []);

    const loadPromociones = async () => {
        try {
            setLoading(true);
            const response = await api.get('/promociones');
            setPromociones(response.data);
        } catch (error) {
            setError('Error al cargar promociones: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const loadEntityOptions = async () => {
        try {
            const [prodRes, catRes] = await Promise.all([
                api.get('/productos?activo=true'),
                api.get('/listas-precios')
            ]);
            setProductos(prodRes.data);
            setCategorias(catRes.data);
        } catch (error) {
            console.warn('Error loading entity options:', error);
        }
    };

    const loadEntidadesForAmbito = async (ambito) => {
        if (!ambito || ambito === 'carrito' || ambito === 'cliente') {
            setEntidades([]);
            return;
        }
        try {
            const response = await api.get(`/promociones/opciones/entidades?ambito=${ambito}`);
            setEntidades(response.data);
        } catch (error) {
            console.warn('Error loading entidades:', error);
        }
    };

    const handleAmbitoChange = (e) => {
        const ambito = e.target.value;
        setFormData({ ...formData, ambito_aplicacion: ambito, entidad_id: '' });
        loadEntidadesForAmbito(ambito);
    };

    const openCreateModal = () => {
        setEditingPromocion(null);
        setFormData({
            nombre: '',
            descripcion: '',
            tipo: 'porcentaje',
            valor_descuento: 0,
            ambito_aplicacion: 'producto',
            entidad_id: '',
            cantidad_minima: 1,
            fecha_inicio: new Date().toISOString().slice(0, 16),
            fecha_fin: '',
            uso_maximo: '',
            prioridad: 0,
            stackeable: false
        });
        setShowModal(true);
    };

    const openEditModal = (promocion) => {
        setEditingPromocion(promocion);
        const isMarcaFabricante = promocion.ambito_aplicacion === 'marca' || promocion.ambito_aplicacion === 'fabricante';
        setFormData({
            nombre: promocion.nombre,
            descripcion: promocion.descripcion || '',
            tipo: promocion.tipo,
            valor_descuento: promocion.valor_descuento,
            ambito_aplicacion: promocion.ambito_aplicacion,
            entidad_id: isMarcaFabricante ? (promocion.entidad_nombre || '') : (promocion.entidad_id || ''),
            cantidad_minima: promocion.cantidad_minima || 1,
            fecha_inicio: promocion.fecha_inicio ? new Date(promocion.fecha_inicio).toISOString().slice(0, 16) : '',
            fecha_fin: promocion.fecha_fin ? new Date(promocion.fecha_fin).toISOString().slice(0, 16) : '',
            uso_maximo: promocion.uso_maximo || '',
            prioridad: promocion.prioridad || 0,
            stackeable: promocion.stackeable || false
        });
        loadEntidadesForAmbito(promocion.ambito_aplicacion);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const isMarcaFabricante = formData.ambito_aplicacion === 'marca' || formData.ambito_aplicacion === 'fabricante';
            const payload = {
                ...formData,
                entidad_id: isMarcaFabricante ? null : (formData.entidad_id ? parseInt(formData.entidad_id) : null),
                entidad_nombre: isMarcaFabricante ? (formData.entidad_id || null) : null,
                cantidad_minima: parseInt(formData.cantidad_minima) || 1,
                uso_maximo: formData.uso_maximo ? parseInt(formData.uso_maximo) : null,
                prioridad: parseInt(formData.prioridad) || 0,
                stackeable: Boolean(formData.stackeable)
            };

            if (editingPromocion) {
                await api.put(`/promociones/${editingPromocion.id}`, payload);
                setSuccess('Promoción actualizada correctamente');
            } else {
                await api.post('/promociones', payload);
                setSuccess('Promoción creada correctamente');
            }
            setShowModal(false);
            loadPromociones();
        } catch (error) {
            setError('Error al guardar promoción: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleCancelar = async (id) => {
        if (!window.confirm('¿Está seguro de cancelar esta promoción?')) return;
        try {
            await api.put(`/promociones/${id}/cancelar`);
            setSuccess('Promoción cancelada');
            loadPromociones();
        } catch (error) {
            setError('Error al cancelar promoción: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleActivar = async (id) => {
        try {
            await api.put(`/promociones/${id}`, { activo: true });
            setSuccess('Promoción activada');
            loadPromociones();
        } catch (error) {
            setError('Error al activar promoción: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleEliminar = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar esta promoción? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/promociones/${id}`);
            setSuccess('Promoción eliminada');
            loadPromociones();
        } catch (error) {
            setError('Error al eliminar promoción: ' + (error.response?.data?.error || error.message));
        }
    };

    const loadStats = async (promocion) => {
        try {
            const response = await api.get(`/promociones/${promocion.id}/estadisticas`);
            setShowStats(response.data);
        } catch (error) {
            setError('Error al cargar estadísticas: ' + (error.response?.data?.error || error.message));
        }
    };

    const getTipoLabel = (tipo) => {
        const labels = {
            'porcentaje': '% Descuento',
            'bogo': 'Buy X Get Free',
            'b2g': 'Buy 2 Get % Off',
            'precio_fijo': 'Precio Fijo',
            'cantidad': 'Cantidad x Precio'
        };
        return labels[tipo] || tipo;
    };

    const getAmbitoLabel = (ambito) => {
        const labels = {
            'producto': 'Producto',
            'categoria': 'Categoría',
            'marca': 'Marca',
            'fabricante': 'Fabricante',
            'carrito': 'Carrito Completo',
            'cliente': 'Cliente Específico'
        };
        return labels[ambito] || ambito;
    };

    const getEntidadNombre = (promocion) => {
        if (!promocion.entidad_id && !promocion.entidad_nombre) return '-';
        switch (promocion.ambito_aplicacion) {
            case 'producto':
                const prod = productos.find(p => p.id === promocion.entidad_id);
                return prod?.nombre || `ID: ${promocion.entidad_id}`;
            case 'categoria':
                const cat = categorias.find(c => c.id === promocion.entidad_id);
                return cat?.nombre || `ID: ${promocion.entidad_id}`;
            case 'marca':
            case 'fabricante':
                return promocion.entidad_nombre || '-';
            default:
                return promocion.ambito_aplicacion;
        }
    };

    const formatDate = (date) => {
        if (!date) return 'Sin límite';
        return new Date(date).toLocaleString('es-AR');
    };

    const clearMessages = () => {
        setError(null);
        setSuccess(null);
    };

    return (
        <div className="promociones-container">
            <div className="promociones-header">
                <h1>Gestión de Promociones</h1>
                {canEdit && (
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        + Nueva Promoción
                    </button>
                )}
            </div>

            {error && <div className="alert alert-error" onClick={clearMessages}>{error}</div>}
            {success && <div className="alert alert-success" onClick={clearMessages}>{success}</div>}

            {loading ? (
                <div className="loading">Cargando promociones...</div>
            ) : (
                <div className="promociones-table-container">
                    <table className="promociones-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>Ámbito</th>
                                <th>Período</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promociones.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-state">No hay promociones registradas</td>
                                </tr>
                            ) : (
                                promociones.map(p => (
                                    <tr key={p.id} className={!p.activo ? 'inactive' : ''}>
                                        <td>
                                            <strong>{p.nombre}</strong>
                                            {p.descripcion && (
                                                <>
                                                    <br /><small>{p.descripcion}</small>
                                                </>
                                            )}
                                        </td>
                                        <td>{getTipoLabel(p.tipo)}</td>
                                        <td>
                                            {p.tipo === 'porcentaje' ? `${p.valor_descuento}%` :
                                             p.tipo === 'precio_fijo' ? `$${p.valor_descuento}` :
                                             p.tipo === 'b2g' ? `${p.valor_descuento}%` :
                                             p.valor_descuento}
                                        </td>
                                        <td>
                                            {getAmbitoLabel(p.ambito_aplicacion)}
                                            {p.ambito_aplicacion !== 'carrito' && (
                                                <>
                                                    <br /><small>{getEntidadNombre(p)}</small>
                                                </>
                                            )}
                                        </td>
                                        <td>
                                            <small>Desde: {formatDate(p.fecha_inicio)}</small><br/>
                                            <small>Hasta: {formatDate(p.fecha_fin)}</small>
                                        </td>
                                        <td>
                                            <span className={`badge ${p.activo ? 'badge-active' : 'badge-inactive'}`}>
                                                {p.activo ? 'Activa' : 'Cancelada'}
                                            </span>
                                            {p.uso_maximo && (
                                                <>
                                                    <br /><small>Usos: {p.uso_actual}/{p.uso_maximo}</small>
                                                </>
                                            )}
                                        </td>
                                        <td className="actions">
                                            <button className="btn btn-sm" onClick={() => loadStats(p)} title="Estadísticas">
                                                📊
                                            </button>
                                            {canEdit && p.activo && (
                                                <button className="btn btn-sm btn-warning" onClick={() => handleCancelar(p.id)} title="Cancelar">
                                                    ❌
                                                </button>
                                            )}
                                            {canEdit && !p.activo && (
                                                <button className="btn btn-sm btn-success" onClick={() => handleActivar(p.id)} title="Activar">
                                                    ✅
                                                </button>
                                            )}
                                            {canEdit && (
                                                <button className="btn btn-sm btn-primary" onClick={() => openEditModal(p)} title="Editar">
                                                    ✏️
                                                </button>
                                            )}
                                            {canEdit && p.uso_actual === 0 && (
                                                <button className="btn btn-sm btn-danger" onClick={() => handleEliminar(p.id)} title="Eliminar">
                                                    🗑️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal for Create/Edit */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingPromocion ? 'Editar Promoción' : 'Nueva Promoción'}</h2>
                            <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nombre *</label>
                                        <input
                                            type="text"
                                            value={formData.nombre}
                                            onChange={e => setFormData({...formData, nombre: e.target.value})}
                                            required
                                            placeholder="Ej: Descuento de Verano"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Descripción</label>
                                        <textarea
                                            value={formData.descripcion}
                                            onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                            placeholder="Detalles de la promoción..."
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Tipo de Promoción *</label>
                                        <select
                                            value={formData.tipo}
                                            onChange={e => setFormData({...formData, tipo: e.target.value})}
                                        >
                                            <option value="porcentaje">Porcentaje de Descuento</option>
                                            <option value="b2g">Buy 2 Get % Off (2nda unidad)</option>
                                            <option value="precio_fijo">Precio Fijo Especial</option>
                                            <option value="cantidad">Pack x Precio (ej: 3 por $10)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            {formData.tipo === 'porcentaje' ? 'Porcentaje (%)' : 
                                             formData.tipo === 'precio_fijo' ? 'Precio ($)' : 
                                             formData.tipo === 'cantidad' ? 'Descuento ($)' : 
                                             '% Descuento 2nda unidad'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.valor_descuento}
                                            onChange={e => setFormData({...formData, valor_descuento: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Ámbito de Aplicación *</label>
                                        <select
                                            value={formData.ambito_aplicacion}
                                            onChange={handleAmbitoChange}
                                        >
                                            <option value="producto">Producto Específico</option>
                                            <option value="categoria">Categoría (Lista de Precios)</option>
                                            <option value="marca">Marca</option>
                                            <option value="fabricante">Fabricante</option>
                                            <option value="carrito">Carrito Completo</option>
                                        </select>
                                    </div>
                                    {formData.ambito_aplicacion !== 'carrito' && (
                                        <div className="form-group">
                                            <label>Seleccionar {getAmbitoLabel(formData.ambito_aplicacion)}</label>
                                        <select
                                            value={formData.entidad_id}
                                            onChange={e => setFormData({...formData, entidad_id: e.target.value})}
                                            required={formData.ambito_aplicacion !== 'carrito'}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {entidades.map(e => (
                                                <option key={e.id || e.nombre} value={(formData.ambito_aplicacion === 'marca' || formData.ambito_aplicacion === 'fabricante') ? e.nombre : e.id}>
                                                    {e.nombre} {e.codigo ? `(${e.codigo})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                </div>

                                {(formData.tipo === 'b2g' || formData.tipo === 'cantidad') && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Comprar Mínimo</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.cantidad_minima}
                                                onChange={e => setFormData({...formData, cantidad_minima: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Fecha Inicio *</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.fecha_inicio}
                                            onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Fecha Fin</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.fecha_fin}
                                            onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Límite de Usos (dejar vacío para ilimitado)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.uso_maximo}
                                            onChange={e => setFormData({...formData, uso_maximo: e.target.value})}
                                            placeholder="Ej: 100"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Prioridad</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.prioridad}
                                            onChange={e => setFormData({...formData, prioridad: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group checkbox-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={formData.stackeable}
                                                onChange={e => setFormData({...formData, stackeable: e.target.checked})}
                                            />
                                            Permitir combinar con otras promociones
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingPromocion ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats Modal */}
            {showStats && (
                <div className="modal-overlay" onClick={() => setShowStats(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Estadísticas: {showStats.promocion?.nombre}</h2>
                            <button className="btn-close" onClick={() => setShowStats(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <h3>Total Usos</h3>
                                    <p className="stat-value">{showStats.total_usos}</p>
                                </div>
                                <div className="stat-card">
                                    <h3>Límite</h3>
                                    <p className="stat-value">{showStats.limite_usos || 'Ilimitado'}</p>
                                </div>
                                <div className="stat-card">
                                    <h3>Restantes</h3>
                                    <p className="stat-value">{showStats.usos_restantes !== null ? showStats.usos_restantes : 'Ilimitado'}</p>
                                </div>
                            </div>
                            
                            <h4>Últimos Usos</h4>
                            {showStats.usos_detalles?.length > 0 ? (
                                <table className="mini-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Cliente</th>
                                            <th>Venta</th>
                                            <th>Descuento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {showStats.usos_detalles.map(u => (
                                            <tr key={u.id}>
                                                <td>{new Date(u.used_at).toLocaleString()}</td>
                                                <td>{u.cliente_nombre || 'Anónimo'}</td>
                                                <td>${u.venta_total}</td>
                                                <td>${u.descuento_aplicado}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p>No hay usos registrados</p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowStats(null)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
