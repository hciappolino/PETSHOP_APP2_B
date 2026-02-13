import { useState, useEffect } from 'react';
import api from '../api';

export default function ReporteStockMinimo() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filters
    const [tipoAnimal, setTipoAnimal] = useState('todos');
    const [ordenar, setOrdenar] = useState('urgencia');

    useEffect(() => {
        loadData();
    }, [tipoAnimal, ordenar]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');
            
            const params = { tipo_animal: tipoAnimal, ordenar };
            const response = await api.get('/reportes/stock-bajo-minimo', { params });
            setData(response.data);
        } catch (err) {
            setError('Error al cargar el reporte: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const getUrgenciaBadge = (urgencia) => {
        const badges = {
            'CRITICO': { class: 'badge-danger', text: 'Critico' },
            'ALTO': { class: 'badge-warning', text: 'Alto' },
            'MEDIO': { class: 'badge-info', text: 'Medio' },
            'BAJO': { class: 'badge-secondary', text: 'Bajo' }
        };
        return badges[urgencia] || { class: 'badge-secondary', text: urgencia };
    };

    const getTipoAnimalLabel = (tipo) => {
        const labels = {
            'perro': 'Perro',
            'gato': 'Gato',
            'otros': 'Otros'
        };
        return labels[tipo] || tipo;
    };

    const handleExport = () => {
        if (data.length === 0) return;
        
        const exportData = {
            fecha: new Date().toISOString(),
            filtro_tipo_animal: tipoAnimal,
            total_productos: data.length,
            productos: data
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-stock-minimo-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleAddToPurchaseOrder = (producto) => {
        // TODO: Implement quick add to purchase order
        alert(`Agregar "${producto.producto_nombre}" a orden de compra`);
    };

    const criticalCount = data.filter(p => p.urgencia === 'CRITICO').length;
    const altoCount = data.filter(p => p.urgencia === 'ALTO').length;
    const totalItems = data.reduce((sum, p) => sum + p.diferencia, 0);

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Reporte Stock Bajo Minimo</h1>
                    <p className="text-secondary">Productos que requieren reposicion de stock</p>
                </div>
                <div className="flex gap-sm">
                    <select
                        className="form-select"
                        style={{ width: '150px' }}
                        value={tipoAnimal}
                        onChange={(e) => setTipoAnimal(e.target.value)}
                    >
                        <option value="todos">Todos los tipos</option>
                        <option value="perro">Perro</option>
                        <option value="gato">Gato</option>
                        <option value="otros">Otros</option>
                    </select>
                    <select
                        className="form-select"
                        style={{ width: '150px' }}
                        value={ordenar}
                        onChange={(e) => setOrdenar(e.target.value)}
                    >
                        <option value="urgencia">Por Urgencia</option>
                        <option value="producto">Por Producto</option>
                    </select>
                    <button className="btn btn-outline" onClick={loadData}>Actualizar</button>
                    <button className="btn btn-outline" onClick={handlePrint}>Imprimir</button>
                    <button className="btn btn-outline" onClick={handleExport}>Exportar</button>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xl">
                <div className="card" style={{ borderLeft: '5px solid #ef4444' }}>
                    <div className="flex justify-between items-center mb-md">
                        <span className="text-muted text-sm">CRITICOS</span>
                        <span style={{ fontSize: '2rem' }}>🚨</span>
                    </div>
                    <h2 className="text-danger m-0">{criticalCount}</h2>
                    <p className="text-xs text-muted mt-sm">Stock en 0</p>
                </div>

                <div className="card" style={{ borderLeft: '5px solid #f97316' }}>
                    <div className="flex justify-between items-center mb-md">
                        <span className="text-muted text-sm">ALTA PRIORIDAD</span>
                        <span style={{ fontSize: '2rem' }}>⚠️</span>
                    </div>
                    <h2 className="text-warning m-0">{altoCount}</h2>
                    <p className="text-xs text-muted mt-sm">Requiere accion</p>
                </div>

                <div className="card" style={{ borderLeft: '5px solid #3b82f6' }}>
                    <div className="flex justify-between items-center mb-md">
                        <span className="text-muted text-sm">TOTAL PRODUCTOS</span>
                        <span style={{ fontSize: '2rem' }}>📦</span>
                    </div>
                    <h2 className="text-primary m-0">{data.length}</h2>
                    <p className="text-xs text-muted mt-sm">Bajo stock minimo</p>
                </div>

                <div className="card" style={{ borderLeft: '5px solid #8b5cf6' }}>
                    <div className="flex justify-between items-center mb-md">
                        <span className="text-muted text-sm">UNIDADES FALTANTES</span>
                        <span style={{ fontSize: '2rem' }}>📊</span>
                    </div>
                    <h2 className="text-purple m-0">{totalItems}</h2>
                    <p className="text-xs text-muted mt-sm">Total a reponer</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
            ) : data.length > 0 ? (
                <div className="card">
                    <div className="table-container mt-md">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Codigo</th>
                                    <th>Producto</th>
                                    <th>Tipo</th>
                                    <th className="text-center">Stock Actual</th>
                                    <th className="text-center">Stock Minimo</th>
                                    <th className="text-center">Diferencia</th>
                                    <th>Urgencia</th>
                                    <th>Proveedor</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((producto) => {
                                    const badge = getUrgenciaBadge(producto.urgencia);
                                    return (
                                        <tr key={producto.id} className={producto.urgencia === 'CRITICO' ? 'row-critical' : ''}>
                                            <td className="font-mono text-muted">{producto.codigo}</td>
                                            <td>
                                                <div className="font-bold">{producto.producto_nombre}</div>
                                                <div className="text-xs text-muted">{producto.marca || producto.fabricante}</div>
                                            </td>
                                            <td>{getTipoAnimalLabel(producto.tipo_animal)}</td>
                                            <td className="text-center">
                                                <span className={`font-bold ${producto.stock_actual === 0 ? 'text-danger' : producto.stock_actual <= producto.stock_minimo * 0.25 ? 'text-warning' : ''}`}>
                                                    {producto.stock_actual}
                                                </span>
                                            </td>
                                            <td className="text-center text-muted">{producto.stock_minimo}</td>
                                            <td className="text-center">
                                                <span className="badge badge-danger">-{producto.diferencia}</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${badge.class}`}>{badge.text}</span>
                                            </td>
                                            <td>
                                                {producto.proveedor_nombre ? (
                                                    <div className="text-sm">
                                                        <div className="font-medium">{producto.proveedor_nombre}</div>
                                                        <div className="text-xs text-muted">{producto.proveedor_telefono}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted text-sm">Sin proveedor</span>
                                                )}
                                            </td>
                                            <td>
                                                <button 
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => handleAddToPurchaseOrder(producto)}
                                                    title="Agregar a orden de compra"
                                                >
                                                    🛒
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="text-center p-xl text-muted">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h3>Excelente!</h3>
                        <p>No hay productos por debajo del stock minimo.</p>
                    </div>
                </div>
            )}

            <style>{`
                .grid.grid-cols-1.md\\:grid-cols-4 {
                    display: grid;
                    gap: 1.5rem;
                }
                
                @media (min-width: 768px) {
                    .grid.grid-cols-1.md\\:grid-cols-4 {
                        grid-template-columns: repeat(4, 1fr);
                    }
                }
                
                .text-purple {
                    color: #8b5cf6;
                }
                
                .row-critical {
                    background-color: rgba(239, 68, 68, 0.05);
                }
                
                .row-critical:hover {
                    background-color: rgba(239, 68, 68, 0.1);
                }
                
                .badge-danger {
                    background: #ef4444;
                    color: white;
                }
                
                .badge-warning {
                    background: #f97316;
                    color: white;
                }
                
                .badge-info {
                    background: #3b82f6;
                    color: white;
                }
                
                .badge-secondary {
                    background: #6b7280;
                    color: white;
                }
                
                @media print {
                    .btn, .navbar, .no-print {
                        display: none !important;
                    }
                    
                    .container {
                        padding: 0 !important;
                    }
                    
                    .card {
                        box-shadow: none !important;
                        border: 1px solid #ddd !important;
                    }
                }
            `}</style>
        </div>
    );
}
