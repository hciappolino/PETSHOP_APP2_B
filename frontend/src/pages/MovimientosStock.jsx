import { useState, useEffect } from 'react';
import api from '../api';
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export default function MovimientosStock() {
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtroFecha, setFiltroFecha] = useState('HOY');
    const [fechaInicio, setFechaInicio] = useState(new Date());
    const [fechaFin, setFechaFin] = useState(new Date());

    useEffect(() => {
        loadMovimientos();
    }, [filtroFecha, fechaInicio, fechaFin]);

    const getDateRange = () => {
        const hoy = new Date();
        let inicio, fin;

        switch (filtroFecha) {
            case 'HOY':
                inicio = startOfDay(hoy);
                fin = endOfDay(hoy);
                break;
            case 'AYER':
                const ayer = addDays(hoy, -1);
                inicio = startOfDay(ayer);
                fin = endOfDay(ayer);
                break;
            case 'ESTA_SEMANA':
                inicio = startOfWeek(hoy);
                fin = endOfWeek(hoy);
                break;
            case 'ESTE_MES':
                inicio = startOfMonth(hoy);
                fin = endOfMonth(hoy);
                break;
            case 'ESTE_ANIO':
                inicio = startOfYear(hoy);
                fin = endOfYear(hoy);
                break;
            case 'PERSONALIZADO':
                inicio = fechaInicio;
                fin = fechaFin;
                break;
            default:
                inicio = startOfDay(hoy);
                fin = endOfDay(hoy);
        }

        return { inicio, fin };
    };

    const loadMovimientos = async () => {
        try {
            setLoading(true);
            const { inicio, fin } = getDateRange();
            const response = await api.get('/stock-movimientos', {
                params: {
                    fecha_inicio: inicio.toISOString().split('T')[0],
                    fecha_fin: fin.toISOString().split('T')[0]
                }
            });
            setMovimientos(response.data || []);
        } catch (err) {
            console.error('Error cargando movimientos:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="mb-lg">
                <h1>Movimientos de Stock</h1>
                <p className="text-secondary">Registro de entradas y salidas de stock</p>
            </div>

            {/* Filtros de Fecha */}
            <div className="card p-md mb-md">
                <h3 className="mb-md">Filtrar por Fecha</h3>
                <div className="flex gap-md" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        className={`btn ${filtroFecha === 'HOY' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFiltroFecha('HOY')}
                    >
                        Hoy
                    </button>
                    <button
                        className={`btn ${filtroFecha === 'AYER' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFiltroFecha('AYER')}
                    >
                        Ayer
                    </button>
                    <button
                        className={`btn ${filtroFecha === 'ESTA_SEMANA' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFiltroFecha('ESTA_SEMANA')}
                    >
                        Esta Semana
                    </button>
                    <button
                        className={`btn ${filtroFecha === 'ESTE_MES' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFiltroFecha('ESTE_MES')}
                    >
                        Este Mes
                    </button>
                    <button
                        className={`btn ${filtroFecha === 'ESTE_ANIO' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFiltroFecha('ESTE_ANIO')}
                    >
                        Este Año
                    </button>
                    <button
                        className={`btn ${filtroFecha === 'PERSONALIZADO' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFiltroFecha('PERSONALIZADO')}
                    >
                        Personalizado
                    </button>
                </div>

                {filtroFecha === 'PERSONALIZADO' && (
                    <div className="grid grid-cols-2 gap-md mt-md">
                        <div>
                            <label className="form-label">Desde</label>
                            <input
                                type="date"
                                className="form-input"
                                value={fechaInicio.toISOString().split('T')[0]}
                                onChange={(e) => setFechaInicio(new Date(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="form-label">Hasta</label>
                            <input
                                type="date"
                                className="form-input"
                                value={fechaFin.toISOString().split('T')[0]}
                                onChange={(e) => setFechaFin(new Date(e.target.value))}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Tabla de Movimientos */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="p-md text-center">Cargando...</div>
                ) : movimientos.length === 0 ? (
                    <div className="p-md text-center text-secondary">No hay movimientos en este período</div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Tipo</th>
                                <th>Cantidad</th>
                                <th>Motivo</th>
                                <th>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movimientos.map((mov) => (
                                <tr key={mov.id}>
                                    <td>{new Date(mov.created_at).toLocaleDateString('es-AR')}</td>
                                    <td className="font-semibold">
                                        {mov.marca ? mov.marca.toUpperCase() : ''} - {mov.producto_nombre}
                                    </td>
                                    <td>
                                        <span className={`badge ${mov.tipo === 'ENTRADA' ? 'badge-success' : 'badge-danger'}`}>
                                            {mov.tipo}
                                        </span>
                                    </td>
                                    <td>{mov.cantidad}</td>
                                    <td>{mov.motivo_nombre || mov.motivo || '-'}</td>
                                    <td className="text-secondary text-sm">{mov.notas || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
