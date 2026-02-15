import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

export default function Productos() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState({
        activo: 'true',
        tipo_presentacion: '',
        bajo_stock: 'false',
        stock_negativo: 'false'
    });

    // Modals state
    const [showFormModal, setShowFormModal] = useState(false);
    const [selectedProducto, setSelectedProducto] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        codigo: '',
        fabricante: '',
        marca: '',
        tipo_animal: 'OTROS',
        tipo_presentacion: 'BOLSA',
        factor_conversion: 25,
        stock_minimo: 5
    });

    const { hasPermission } = useAuth();
    const canEdit = hasPermission('productos.editar');

    useEffect(() => {
        loadProductos();
    }, [filter, search]);

    const loadProductos = async () => {
        try {
            setLoading(true);
            const params = { ...filter, search };
            const response = await api.get('/productos', { params });
            setProductos(response.data);
            setError('');
        } catch (err) {
            setError('Error al cargar productos');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAjusteStock = async (productoId, cantidad) => {
        try {
            await api.post(`/productos/${productoId}/ajustar-stock`, {
                cantidad: cantidad,
                motivo: 'AJUSTE'
            });
            loadProductos();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al ajustar stock');
        }
    };

    const descargarPlantilla = () => {
        const encabezados = [
            ["codigo", "fabricante", "marca", "nombre producto", "tipo_presentacion", "factor_conversion", "stock_minimo", "precio_compra", "precio_venta_unidad", "precio_venta_granel"]
        ];
        encabezados.push(["1001", "Purina", "Catchow", "Alimento Perro Adulto 15kg", "BOLSA", 25, 5, 1200.00, 1500.00, 1300.00]);
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(encabezados);
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_articulos.xlsx");
    };

    const exportProductos = () => {
        const rows = [];
        rows.push(["codigo", "fabricante", "marca", "nombre producto", "tipo_presentacion", "factor_conversion", "stock_minimo", "precio_compra", "precio_venta_unidad", "precio_venta_granel"]);
        productos.forEach(p => {
            rows.push([
                p.codigo || '',
                p.fabricante || '',
                p.marca || '',
                p.nombre || '',
                p.tipo_presentacion || '',
                p.factor_conversion || '',
                p.stock_minimo || '',
                (p.costo_ultima_compra != null) ? parseFloat(p.costo_ultima_compra) : '',
                (p.precio_venta_unidad != null) ? parseFloat(p.precio_venta_unidad) : '',
                (p.precio_venta_granel != null) ? parseFloat(p.precio_venta_granel) : ''
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Productos");
        XLSX.writeFile(wb, "productos_export.xlsx");
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const data = new FormData();
        data.append('archivo', file);

        try {
            setLoading(true);
            const response = await api.post('/productos/importar-excel', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            let message = `Importacion finalizada:\n- Creados: ${response.data.creados}\n- Actualizados: ${response.data.actualizados}`;
            
            if (response.data.errors && response.data.errors.length > 0) {
                message += `\n- Errores: ${response.data.errors.length} filas con errores`;
                const errorsDetails = response.data.errors.map(err => 
                    `Fila ${err.row} (Codigo: ${err.codigo || 'N/A'}): ${err.errors.join(', ')}`
                ).join('\n');
                message += `\n\nDetalles de errores:\n${errorsDetails}`;
            }
            
            alert(message);
            loadProductos();
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Error al importar archivo';
            const errorDetails = err.response?.data?.details;
            alert(errorDetails ? `${errorMessage}\n\nDetalles: ${errorDetails}` : errorMessage);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    let rows;
    if (loading) {
        rows = (
            <tr><td colSpan="8" className="text-center">Cargando...</td></tr>
        );
    } else if (productos.length === 0) {
        rows = (
            <tr><td colSpan="8" className="text-center">No se encontraron productos</td></tr>
        );
    } else {
        rows = productos.map(p => {
            const stockActual = parseFloat(p.stock_actual || 0);
            const stockMinimo = parseFloat(p.stock_minimo || 0);
            const esStockNegativo = stockActual < 0;
            const esStockBajo = stockActual >= 0 && stockActual <= stockMinimo;
            
            return (
            <tr key={p.id}>
                <td><span className="badge badge-outline">{p.codigo}</span></td>
                <td>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '14px' }}>
                        {p.marca ? p.marca.toUpperCase() : ''}
                    </div>
                    <div style={{ fontSize: '13px' }}>{p.nombre}</div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>{p.fabricante || '-'}</div>
                </td>
                <td>{p.tipo_animal || 'OTROS'}</td>
                <td>{p.tipo_presentacion}</td>
                <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{p.factor_conversion}</td>
                <td style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    <span 
                        className={esStockNegativo ? 'stock-negativo' : (esStockBajo ? 'text-error font-bold' : '')}
                        style={{ 
                            backgroundColor: esStockNegativo ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                            padding: '4px 8px',
                            borderRadius: '4px'
                        }}
                    >
                        {Math.round(stockActual)}
                    </span>
                </td>
                <td style={{ fontSize: '16px', fontWeight: 'bold' }}>{Math.round(p.stock_minimo)}</td>
                {canEdit && (
                    <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                                className="btn btn-sm btn-outline"
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleAjusteStock(p.id, 1)}
                                title="Agregar 1"
                            >+</button>
                            <button 
                                className="btn btn-sm btn-outline"
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleAjusteStock(p.id, -1)}
                                title="Restar 1"
                            >-</button>
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={() => {
                                    setSelectedProducto(p);
                                    setFormData({
                                        nombre: p.nombre || '',
                                        codigo: p.codigo || '',
                                        fabricante: p.fabricante || '',
                                        marca: p.marca || '',
                                        tipo_animal: p.tipo_animal || 'OTROS',
                                        tipo_presentacion: p.tipo_presentacion || 'BOLSA',
                                        factor_conversion: p.factor_conversion || 1,
                                        stock_minimo: p.stock_minimo || 0
                                    });
                                    setShowFormModal(true);
                                }}
                            >
                                Editar
                            </button>
                        </div>
                    </td>
                )}
            </tr>
            );
        });
    }

    return (
        <div className="container-fluid">
            <div className="flex justify-between items-center mb-lg">
                <h1 className="text-2xl font-bold">Gestion de Articulos</h1>
                
                <div className="flex gap-md">
                    {canEdit && (
                        <>
                            <button 
                                className="btn btn-outline flex items-center gap-sm" 
                                onClick={descargarPlantilla}
                                title="Descargar formato Excel"
                            >
                                <span>📄</span> Plantilla
                            </button>

                            <button 
                                className="btn btn-outline flex items-center gap-sm" 
                                onClick={exportProductos}
                                title="Exportar productos actuales"
                            >
                                <span>⬇️</span> Exportar
                            </button>

                            <label className="btn btn-outline flex items-center gap-sm cursor-pointer">
                                <span>📥</span> Importar
                                <input 
                                    type="file" 
                                    hidden 
                                    accept=".xlsx, .xls" 
                                    onChange={handleImportExcel} 
                                />
                            </label>

                            <button 
                                className="btn btn-primary" 
                                onClick={() => {
                                    setFormData({ nombre: '', codigo: '', fabricante: '', marca: '', tipo_animal: 'OTROS', tipo_presentacion: 'BOLSA', factor_conversion: 25, stock_minimo: 5 });
                                    setSelectedProducto(null);
                                    setShowFormModal(true);
                                }}
                            >
                                + Nuevo Producto
                            </button>
                            <div className="btn-group">
                                <a className="btn btn-sm btn-primary" href="/productos/ajuste">+ Ajuste Stock</a>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="card mb-lg p-md flex gap-md items-center">
                <input
                    type="text"
                    placeholder="Buscar por nombre, marca o codigo..."
                    className="form-input flex-1"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select 
                    className="form-input w-48"
                    value={filter.tipo_presentacion}
                    onChange={(e) => setFilter({...filter, tipo_presentacion: e.target.value})}
                >
                    <option value="">Todas las presentaciones</option>
                    <option value="BOLSA">Bolsa</option>
                    <option value="UNIDAD">Unidad</option>
                </select>
                <select 
                    className="form-input w-48"
                    value={filter.stock_negativo}
                    onChange={(e) => setFilter({...filter, stock_negativo: e.target.value})}
                >
                    <option value="false">Todo el Stock</option>
                    <option value="true">Solo Stock Negativo</option>
                </select>
            </div>

            {error && <div className="alert alert-error mb-md">{error}</div>}

            <div className="card overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Codigo</th>
                            <th>Producto</th>
                            <th>Animal</th>
                            <th>Tipo</th>
                            <th>Factor</th>
                            <th>Stock</th>
                            <th>Min.</th>
                            {canEdit && <th>Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>
            </div>

            {showFormModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '600px' }}>
                        <div className="flex justify-between items-center mb-lg">
                            <h3 className="m-0">{selectedProducto ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <button 
                                type="button" 
                                className="btn btn-sm" 
                                onClick={() => { setShowFormModal(false); setSelectedProducto(null); }}
                            >X</button>
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                const payload = {
                                    nombre: formData.nombre,
                                    codigo: formData.codigo,
                                    fabricante: formData.fabricante,
                                    marca: formData.marca,
                                    tipo_animal: formData.tipo_animal,
                                    tipo_presentacion: formData.tipo_presentacion,
                                    factor_conversion: parseFloat(formData.factor_conversion),
                                    stock_minimo: parseFloat(formData.stock_minimo)
                                };

                                if (selectedProducto) {
                                    await api.put(`/productos/${selectedProducto.id}`, payload);
                                } else {
                                    await api.post('/productos', payload);
                                }

                                setShowFormModal(false);
                                setSelectedProducto(null);
                                loadProductos();
                            } catch (err) {
                                alert(err.response?.data?.error || err.message);
                            }
                        }}>
                            <div className="card mb-md" style={{ background: 'var(--bg-secondary)' }}>
                                <h5 className="mt-0 mb-md">Informacion Basica</h5>
                                <div className="grid-2 gap-md">
                                    <div className="form-group">
                                        <label className="form-label">Nombre del Producto *</label>
                                        <input 
                                            type="text"
                                            className="form-input" 
                                            placeholder="Ej: Alimento Premium"
                                            value={formData.nombre} 
                                            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Codigo *</label>
                                        <input 
                                            type="text"
                                            className="form-input" 
                                            placeholder="Ej: SKU-001"
                                            value={formData.codigo} 
                                            onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid-2 gap-md">
                                    <div className="form-group">
                                        <label className="form-label">Fabricante</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Ej: Purina"
                                            value={formData.fabricante}
                                            onChange={(e) => setFormData({...formData, fabricante: e.target.value})}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Marca</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Ej: Catchow"
                                            value={formData.marca}
                                            onChange={(e) => setFormData({...formData, marca: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="form-group mb-md">
                                    <label className="form-label">Tipo de Animal</label>
                                    <select
                                        className="form-select"
                                        value={formData.tipo_animal}
                                        onChange={(e) => setFormData({...formData, tipo_animal: e.target.value})}
                                    >
                                        <option value="OTROS">OTROS</option>
                                        <option value="PERRO">PERRO</option>
                                        <option value="GATO">GATO</option>
                                    </select>
                                </div>
                            </div>

                            <div className="card mb-md" style={{ background: 'var(--bg-secondary)' }}>
                                <h5 className="mt-0 mb-md">Presentacion y Unidades</h5>
                                <div className="form-group mb-md">
                                    <label className="form-label">Tipo de Presentacion *</label>
                                    <select 
                                        className="form-select" 
                                        value={formData.tipo_presentacion} 
                                        onChange={(e) => setFormData({...formData, tipo_presentacion: e.target.value})}
                                        required
                                    >
                                        <option value="BOLSA">BOLSA</option>
                                        <option value="UNIDAD">UNIDAD</option>
                                    </select>
                                </div>

                                {formData.tipo_presentacion === 'BOLSA' && (
                                    <div className="form-group">
                                        <label className="form-label">Peso por Bolsa (kg) *</label>
                                        <input 
                                            type="number" 
                                            step="0.1" 
                                            min="0.1"
                                            className="form-input" 
                                            placeholder="Ej: 25, 2.5, 0.5"
                                            value={formData.factor_conversion} 
                                            onChange={(e) => setFormData({...formData, factor_conversion: e.target.value})}
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="card mb-lg" style={{ background: 'var(--bg-secondary)' }}>
                                <h5 className="mt-0 mb-md">Control de Stock</h5>
                                <div className="form-group">
                                    <label className="form-label">
                                        Stock Minimo {formData.tipo_presentacion === 'BOLSA' ? '(en bolsas)' : '(en unidades)'} *
                                    </label>
                                    <input 
                                        type="number" 
                                        step="1"
                                        min="1"
                                        className="form-input" 
                                        placeholder="Ej: 5"
                                        value={formData.stock_minimo} 
                                        onChange={(e) => setFormData({...formData, stock_minimo: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-md">
                                <button 
                                    type="button"
                                    className="btn btn-outline" 
                                    onClick={() => { setShowFormModal(false); setSelectedProducto(null); }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    {selectedProducto ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
