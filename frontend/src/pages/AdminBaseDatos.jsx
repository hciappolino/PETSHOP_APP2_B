import { useState, useEffect } from 'react';
import api from '../api';

// Spinner component
const Spinner = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4'
    };
    return (
        <div className={`${sizeClasses[size]} border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin`}></div>
    );
};

export default function AdminBaseDatos() {
    const [dbStatus, setDbStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [withSeeds, setWithSeeds] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Auto-dismiss messages
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        checkDB();
    }, []);

    const checkDB = async () => {
        try {
            const res = await api.get('/init/check-db');
            setDbStatus(res.data);
        } catch (err) {
            setDbStatus({ table_count: 0 });
        } finally {
            setLoading(false);
        }
    };

    const handleInitDB = async () => {
        if (confirmText !== 'REINICIAR') {
            setError('Escriba REINICIAR para confirmar');
            return;
        }
        
        setInitializing(true);
        setError(null);
        setSuccess(null);
        
        try {
            // First create a backup
            await api.post('/backups/crear');
            
            // Then drop and recreate
            await api.post('/init/drop-db');
            await api.post('/init/init-db', { withSeeds });
            
            setSuccess('Base de datos reinicializada correctamente');
            setConfirmText('');
            checkDB();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al reinicializar la base de datos');
        } finally {
            setInitializing(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-[var(--text-secondary)]">Verificando estado de la base de datos...</p>
            </div>
        </div>
    );

    const isDBConnected = dbStatus?.table_count > 0;

    return (
        <div className="admin-page">
            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <h1 className="admin-title">
                        <span className="admin-title-icon">🗄️</span>
                        Base de Datos
                    </h1>
                    <p className="admin-subtitle">Gestiona la base de datos del sistema</p>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="alert alert-danger flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-[var(--danger)] hover:text-white">✕</button>
                </div>
            )}
            {success && (
                <div className="alert alert-success flex items-center justify-between">
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="text-[var(--success)] hover:text-white">✕</button>
                </div>
            )}

            {/* Status Card */}
            <div className="card mb-lg">
                <h2 className="text-lg font-bold mb-4">Estado de la Base de Datos</h2>
                <div className="grid-2 gap-lg">
                    <div className="flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDBConnected ? 'bg-[rgba(16,185,129,0.2)]' : 'bg-[rgba(245,158,11,0.2)]'}`}>
                            <span className="text-xl">{isDBConnected ? '✅' : '⚠️'}</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Estado</p>
                            <p className={`text-lg font-bold m-0 ${isDBConnected ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                                {isDBConnected ? 'Conectada' : 'Vacía'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-[rgba(99,102,241,0.2)] flex items-center justify-center">
                            <span className="text-xl">📊</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Tablas</p>
                            <p className="text-lg font-bold m-0">{dbStatus?.table_count || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="border-2 border-[var(--danger)] rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-[var(--danger)] to-red-700 px-6 py-4">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2 m-0">
                        <span>⚠️</span> ZONA DE PELIGRO
                    </h2>
                    <p className="text-red-100 text-sm mt-1 m-0">
                        Esta acción es irreversible. Proceda con precaución.
                    </p>
                </div>
                
                <div className="p-6 bg-[rgba(239,68,68,0.05)]">
                    {/* Info */}
                    <div className="card mb-lg bg-[rgba(239,68,68,0.1)] border-[var(--danger)]">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[rgba(239,68,68,0.2)] flex items-center justify-center flex-shrink-0">
                                <span>ℹ️</span>
                            </div>
                            <div>
                                <h4 className="font-bold mb-1 text-[var(--danger)]">Información importante</h4>
                                <p className="text-[var(--text-secondary)] text-sm m-0 mb-2">
                                    Esta acción <strong>ELIMINARÁ TODOS los datos</strong> y recreará las tablas. 
                                    Se creará un backup automáticamente antes de proceder.
                                </p>
                                <p className="text-[var(--text-secondary)] text-sm m-0">
                                    Esta operación puede tomar varios minutos dependiendo del tamaño de la base de datos.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Init Type Selection */}
                    <div className="mb-lg">
                        <label className="form-label mb-3">Tipo de inicialización:</label>
                        <div className="space-y-3">
                            <label className={`flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg border-2 cursor-pointer transition-all ${withSeeds ? 'border-[var(--primary)]' : 'border-[var(--border)]'}`}>
                                <input
                                    type="radio"
                                    checked={withSeeds}
                                    onChange={() => setWithSeeds(true)}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <span className="font-medium">Con datos de ejemplo</span>
                                    <span className="text-[var(--text-muted)] text-sm ml-2">(productos, clientes, proveedores demo)</span>
                                </div>
                                <span className="text-2xl">📦</span>
                            </label>
                            <label className={`flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg border-2 cursor-pointer transition-all ${!withSeeds ? 'border-[var(--primary)]' : 'border-[var(--border)]'}`}>
                                <input
                                    type="radio"
                                    checked={!withSeeds}
                                    onChange={() => setWithSeeds(false)}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <span className="font-medium">Base vacía</span>
                                    <span className="text-[var(--text-muted)] text-sm ml-2">(solo usuario admin + configuración mínima)</span>
                                </div>
                                <span className="text-2xl">📋</span>
                            </label>
                        </div>
                    </div>

                    {/* Confirmation Input */}
                    <div className="mb-lg">
                        <label className="form-label mb-2">
                            <span className="text-[var(--danger)]">✱</span> Confirmar escribiendo <code className="bg-[rgba(239,68,68,0.2)] px-2 py-1 rounded text-[var(--danger)]">REINICIAR</code>:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                            className="form-input border-2 border-[var(--danger)] focus:border-[var(--danger)]"
                            placeholder="Escriba REINICIAR"
                            disabled={initializing}
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                            Escriba exactamente "REINICIAR" para habilitar el botón
                        </p>
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={handleInitDB}
                        disabled={confirmText !== 'REINICIAR' || initializing}
                        className="btn btn-danger btn-lg w-full flex items-center justify-center gap-2"
                    >
                        {initializing && <Spinner size="sm" />}
                        {initializing ? 'Reinicializando Base de Datos...' : '🔴 Reinicializar Base de Datos'}
                    </button>
                    
                    {initializing && (
                        <div className="text-center mt-4">
                            <p className="text-[var(--danger)] text-sm">
                                Por favor espere... Esto puede tomar varios minutos.
                            </p>
                            <div className="mt-2 flex justify-center">
                                <Spinner size="md" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Credentials Info */}
            <div className="card mt-lg bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[rgba(99,102,241,0.2)] flex items-center justify-center">
                        <span>🔑</span>
                    </div>
                    <div>
                        <p className="text-[var(--text-muted)] text-sm m-0">Usuario inicial por defecto</p>
                        <p className="font-bold m-0">admin / admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
