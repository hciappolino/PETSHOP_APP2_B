import { useState, useEffect } from 'react';
import api from '../api';

// Spinner component
const Spinner = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };
    return (
        <div className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}></div>
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
                <p className="mt-4 text-gray-600">Verificando estado de la base de datos...</p>
            </div>
        </div>
    );

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">🗄️ Base de Datos</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded relative">
                    {error}
                    <button onClick={() => setError(null)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 mb-4 rounded relative">
                    {success}
                    <button onClick={() => setSuccess(null)} className="absolute top-2 right-2 text-green-500 hover:text-green-700">✕</button>
                </div>
            )}

            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="font-bold mb-2">Estado de la Base de Datos</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-gray-500">Estado:</span>
                        <span className={`ml-2 font-medium ${dbStatus?.table_count > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {dbStatus?.table_count > 0 ? '✅ Conectada' : '⚠️ Vacía'}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">Tablas:</span>
                        <span className="ml-2 font-medium">{dbStatus?.table_count || 0}</span>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="border-2 border-red-500 rounded-lg overflow-hidden">
                <div className="bg-red-600 px-4 py-3">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <span>⚠️</span> ZONA DE PELIGRO
                    </h2>
                    <p className="text-red-100 text-sm mt-1">
                        Esta acción es irreversible. Proceda con precaución.
                    </p>
                </div>
                
                <div className="p-4 bg-red-50">
                    <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4 mb-4">
                        <h3 className="font-bold text-red-800 mb-2">ℹ️ Información importante</h3>
                        <p className="text-red-700 text-sm mb-2">
                            Esta acción <strong>ELIMINARÁ TODOS los datos</strong> y recreará las tablas. 
                            Se creará un backup automáticamente antes de proceder.
                        </p>
                        <p className="text-red-700 text-sm">
                            Esta operación puede tomar varios minutos dependiendo del tamaño de la base de datos.
                        </p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Tipo de inicialización:</label>
                        <div className="space-y-2">
                            <label className="flex items-center p-3 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input
                                    type="radio"
                                    checked={withSeeds}
                                    onChange={() => setWithSeeds(true)}
                                    className="mr-3"
                                />
                                <div>
                                    <span className="font-medium">Con datos de ejemplo</span>
                                    <span className="text-gray-500 text-sm ml-2">(productos, clientes, proveedores demo)</span>
                                </div>
                            </label>
                            <label className="flex items-center p-3 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input
                                    type="radio"
                                    checked={!withSeeds}
                                    onChange={() => setWithSeeds(false)}
                                    className="mr-3"
                                />
                                <div>
                                    <span className="font-medium">Base vacía</span>
                                    <span className="text-gray-500 text-sm ml-2">(solo usuario admin + configuración mínima)</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-red-800 mb-2">
                            <span className="text-red-600">✱</span> Confirmar escribiendo <code className="bg-red-100 px-1 rounded">REINICIAR</code>:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                            className="w-full border-2 border-red-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            placeholder="Escriba REINICIAR"
                            disabled={initializing}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Escriba exactamente "REINICIAR" para habilitar el botón
                        </p>
                    </div>

                    <button 
                        onClick={handleInitDB}
                        disabled={confirmText !== 'REINICIAR' || initializing}
                        className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                        {initializing && <Spinner size="sm" />}
                        {initializing ? 'Reinicializando Base de Datos...' : '🔴 Reinicializar Base de Datos'}
                    </button>
                    
                    {initializing && (
                        <p className="text-center text-red-600 text-sm mt-2">
                            Por favor espere... Esto puede tomar varios minutos.
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-3 rounded">
                <p><strong>Usuario inicial:</strong> admin / admin123</p>
            </div>
        </div>
    );
}
