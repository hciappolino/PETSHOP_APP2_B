import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function FondosNuevo() {
    const navigate = useNavigate();
    const [cuentas, setCuentas] = useState([]);
    const [tipoMovimiento, setTipoMovimiento] = useState('DEPOSITO'); // DEPOSITO | RETIRO | GASTO | AJUSTE
    const [form, setForm] = useState({ cuenta_id: '', monto: '', descripcion: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/cuentas-pago');
                setCuentas(res.data);
            } catch (err) {
                console.error(err);
            }
        })();
    }, []);

    const handleSubmit = async () => {
        try {
            if (!form.cuenta_id || !form.monto) return alert('Cuenta y monto son requeridos');
            
            // Determinar tipo (INGRESO/EGRESO) según el tipoMovimiento
            let tipo = 'EGRESO';
            let motivo = tipoMovimiento;
            
            if (tipoMovimiento === 'DEPOSITO') {
                tipo = 'INGRESO';
                motivo = 'DEPOSITO';
            }
            
            setLoading(true);
            await api.post('/fondos-movimientos', {
                cuenta_id: parseInt(form.cuenta_id),
                tipo,
                monto: parseFloat(form.monto),
                motivo,
                descripcion: form.descripcion
            });
            alert('Movimiento registrado exitosamente');
            setForm({ cuenta_id: '', monto: '', descripcion: '' });
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
                    <h1>Nuevo Comprobante - Fondos</h1>
                    <p className="text-secondary">Registrar movimiento de fondos</p>
                </div>
            </div>

            {/* Selector de tipo de movimiento */}
            <div className="card p-md mb-md">
                <h3>Tipo de Movimiento</h3>
                <div className="flex gap-md mt-md" style={{ flexWrap: 'wrap' }}>
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="DEPOSITO" 
                            checked={tipoMovimiento === 'DEPOSITO'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Depósito (INGRESO)</span>
                    </label>
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="RETIRO" 
                            checked={tipoMovimiento === 'RETIRO'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Retiro (EGRESO)</span>
                    </label>
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="GASTO" 
                            checked={tipoMovimiento === 'GASTO'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Gasto (EGRESO)</span>
                    </label>
                    <label className="flex items-center gap-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoMovimiento" 
                            value="AJUSTE" 
                            checked={tipoMovimiento === 'AJUSTE'}
                            onChange={(e) => setTipoMovimiento(e.target.value)}
                        />
                        <span>Ajuste (EGRESO)</span>
                    </label>
                </div>
            </div>

            {/* Formulario */}
            <div className="card p-md" style={{ maxWidth: 600 }}>
                <div className="grid grid-cols-1 gap-md">
                    <div>
                        <label className="form-label">Cuenta</label>
                        <select 
                            className="form-select w-full" 
                            value={form.cuenta_id} 
                            onChange={(e) => setForm({...form, cuenta_id: e.target.value})}
                        >
                            <option value="">Seleccionar cuenta</option>
                            {cuentas.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre} ({c.tipo}) - Saldo: ${c.saldo_actual}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="form-label">Monto</label>
                        <input 
                            className="form-input w-full" 
                            type="number" 
                            placeholder="Monto" 
                            value={form.monto} 
                            onChange={(e) => setForm({...form, monto: e.target.value})}
                            min="0"
                            step="0.01"
                        />
                    </div>

                    <div>
                        <label className="form-label">Descripción (opcional)</label>
                        <textarea 
                            className="form-input w-full" 
                            rows="3"
                            placeholder="Descripción del movimiento"
                            value={form.descripcion}
                            onChange={(e) => setForm({...form, descripcion: e.target.value})}
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-sm">
                        <button className="btn btn-outline" onClick={() => navigate('/fondos')}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Guardando...' : 'Registrar Movimiento'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
