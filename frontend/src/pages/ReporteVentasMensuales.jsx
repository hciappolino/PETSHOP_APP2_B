import { useEffect, useState } from 'react';
import api from '../api';

const formatCurrency = (amount) => {
    const num = Math.round(parseFloat(amount) || 0);
    return '$' + num.toLocaleString('es-AR');
};

const getMesAnioLabel = (mesNumero, anio) => {
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const mes = meses[(parseInt(mesNumero, 10) || 1) - 1] || 'MES';
    return `${mes}${anio}`;
};

export default function ReporteVentasMensuales() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [meses, setMeses] = useState(12);

    useEffect(() => {
        loadData();
    }, [meses]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await api.get('/reportes/ventas-por-mes', { params: { meses } });
            setData(response.data || []);
        } catch (err) {
            setError('Error al cargar el reporte: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>Reporte Ventas por Mes</h1>
                    <p className="text-secondary">Resumen mensual de ventas</p>
                </div>
                <div className="flex gap-sm">
                    <select
                        className="form-select"
                        style={{ width: '170px' }}
                        value={meses}
                        onChange={(e) => setMeses(parseInt(e.target.value, 10))}
                    >
                        <option value={6}>Ultimos 6 meses</option>
                        <option value={12}>Ultimos 12 meses</option>
                        <option value={24}>Ultimos 24 meses</option>
                    </select>
                    <button className="btn btn-outline" onClick={loadData}>Actualizar</button>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-md">{error}</div>}

            {loading ? (
                <div className="text-center p-xl"><div className="spinner mx-auto"></div></div>
            ) : (
                <div className="card">
                    <div className="table-container mt-md">
                        <table>
                            <thead>
                                <tr>
                                    <th>MesAno</th>
                                    <th>Total Ventas</th>
                                    <th>Promedio Cantidad Ventas Dia</th>
                                    <th>Ticket Promedio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length > 0 ? (
                                    data.map((row, i) => (
                                        <tr key={i}>
                                            <td className="font-bold">{getMesAnioLabel(row.mes_numero, row.anio)}</td>
                                            <td className="text-success font-bold">{formatCurrency(row.total_ventas)}</td>
                                            <td>{parseFloat(row.promedio_cantidad_ventas_dia || 0).toFixed(2)}</td>
                                            <td>{formatCurrency(row.ticket_promedio)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="text-center text-muted p-lg">Sin datos de ventas mensuales</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
