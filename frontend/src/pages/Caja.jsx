import { useState, useEffect } from 'react';
import api from '../api';
import './Caja.css';

const formatMoney = (amount) => {
    const num = Math.round(parseFloat(amount) || 0);
    return '$' + num.toLocaleString('es-AR');
};

export default function Caja() {
    const [sesionActual, setSesionActual] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [montoInicial, setMontoInicial] = useState('');
    const [montoFinalReal, setMontoFinalReal] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [sesionRes, historialRes] = await Promise.all([
                api.get('/sesiones-caja/current'),
                api.get('/sesiones-caja?estado=CERRADA')
            ]);

            setSesionActual(sesionRes.data);
            setHistorial(historialRes.data.slice(0, 10));
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAbrirCaja = async (e) => {
        e.preventDefault();

        if (!montoInicial || parseFloat(montoInicial) < 0) {
            alert('Ingrese un monto inicial válido');
            return;
        }

        try {
            await api.post('/sesiones-caja/open', {
                monto_inicial: parseFloat(montoInicial)
            });

            alert('Caja abierta exitosamente');
            setMontoInicial('');
            loadData();
        } catch (error) {
            alert('Error al abrir caja: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleCerrarCaja = async (e) => {
        e.preventDefault();

        if (!montoFinalReal || parseFloat(montoFinalReal) < 0) {
            alert('Ingrese el monto final real');
            return;
        }

        if (!confirm('¿Está seguro de cerrar la caja?')) {
            return;
        }

        try {
            await api.post(`/sesiones-caja/${sesionActual.id}/close`, {
                monto_final_real: parseFloat(montoFinalReal)
            });

            alert('Caja cerrada exitosamente');
            setMontoFinalReal('');
            loadData();
        } catch (error) {
            alert('Error al cerrar caja: ' + (error.response?.data?.error || error.message));
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <h1>Gestión de Caja</h1>
            <p className="text-secondary mb-xl">Control de sesiones de caja registradora</p>

            {!sesionActual ? (
                <div className="card max-w-md mx-auto">
                    <div className="card-header">
                        <h3>Abrir Caja</h3>
                    </div>
                    <form onSubmit={handleAbrirCaja}>
                        <div className="form-group">
                            <label className="form-label">Monto Inicial (Efectivo)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={montoInicial}
                                onChange={(e) => setMontoInicial(e.target.value)}
                                step="0.01"
                                min="0"
                                required
                                placeholder="0.00"
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn btn-primary w-full">
                            Abrir Caja
                        </button>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                    <div className="card">
                        <div className="flex justify-between items-center mb-md">
                            <h3 className="m-0">Sesión Activa</h3>
                            <span className="badge badge-success">ABIERTA</span>
                        </div>

                        <div className="flex flex-col gap-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">Iniciada:</span>
                                <span>{new Date(sesionActual.apertura_fecha).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Monto Inicial:</span>
                                <span className="font-bold">{formatMoney(sesionActual.saldo_apertura || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Ventas Acumuladas:</span>
                                <span className="font-bold">{formatMoney((parseFloat(sesionActual.saldo_cierre_esperado || 0) - parseFloat(sesionActual.saldo_apertura || 0)))}</span>
                            </div>
                            <div className="flex justify-between border-t pt-sm mt-sm">
                                <span className="font-bold">Total Esperado:</span>
                                <span className="font-bold text-primary">{formatMoney(sesionActual.saldo_cierre_esperado || sesionActual.saldo_apertura)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="mb-md">Cerrar Caja</h3>
                        <form onSubmit={handleCerrarCaja}>
                            <div className="form-group">
                                <label className="form-label">Efectivo Real en Caja</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={montoFinalReal}
                                    onChange={(e) => setMontoFinalReal(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="Ingrese el monto contado"
                                />
                                <small className="text-muted block mt-sm">
                                    Cuente el efectivo físico en caja e ingrese el total para detectar diferencias.
                                </small>
                            </div>
                            <button type="submit" className="btn btn-danger w-full">
                                Cerrar Caja y Finalizar Día
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {historial.length > 0 && (
                <div className="card mt-xl">
                    <h3 className="mb-md">Historial de Cierres Recientes</h3>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Apertura</th>
                                    <th>Cierre</th>
                                    <th>Inicial</th>
                                    <th>Esperado</th>
                                    <th>Real</th>
                                    <th>Diferencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map(s => (
                                    <tr key={s.id}>
                                        <td>{new Date(s.apertura_fecha).toLocaleDateString()}</td>
                                        <td>{new Date(s.cierre_fecha).toLocaleDateString()}</td>
                                        <td>{formatMoney(s.saldo_apertura)}</td>
                                        <td>{formatMoney(s.saldo_cierre_esperado)}</td>
                                        <td>{formatMoney(s.saldo_cierre_real)}</td>
                                        <td>
                                            <span className={`badge ${parseFloat(s.diferencia) === 0 ? 'badge-success' : 'badge-danger'}`}>
                                                {formatMoney(s.diferencia)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
