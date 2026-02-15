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

// Modal component
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-gray-600 mb-4">{message}</p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white rounded ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function AdminBackups() {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: 'created', direction: 'desc' });
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    
    // Modal state
    const [restoreModal, setRestoreModal] = useState({ open: false, filename: '' });

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
        loadBackups();
    }, []);

    const loadBackups = async () => {
        try {
            const res = await api.get('/backups');
            setBackups(res.data);
        } catch (err) {
            setError('Error al cargar backups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        setCreating(true);
        setError(null);
        setSuccess(null);
        
        try {
            const res = await api.post('/backups/crear');
            setSuccess('Backup creado correctamente');
            loadBackups();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear backup');
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (filename) => {
        try {
            const res = await api.get(`/backups/descargar/${filename}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setError('Error al descargar backup');
        }
    };

    const handleRestore = async () => {
        const filename = restoreModal.filename;
        setRestoreModal({ open: false, filename: '' });
        
        setRestoring(true);
        setError(null);
        setSuccess(null);
        
        try {
            await api.post('/backups/restaurar', { filename });
            setSuccess('Base de datos restaurada correctamente');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al restaurar backup');
        } finally {
            setRestoring(false);
        }
    };

    const openRestoreModal = (filename) => {
        setRestoreModal({ open: true, filename });
    };

    const handleDelete = async (filename) => {
        if (!confirm(`¿Está seguro de eliminar el backup "${filename}"?`)) return;
        
        try {
            await api.delete(`/backups/${filename}`);
            setSuccess('Backup eliminado correctamente');
            loadBackups();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar backup');
        }
    };

    // Sorting function
    const sortData = (data) => {
        const sorted = [...data].sort((a, b) => {
            if (sortConfig.key === 'filename') {
                return sortConfig.direction === 'asc' 
                    ? a.filename.localeCompare(b.filename)
                    : b.filename.localeCompare(a.filename);
            }
            if (sortConfig.key === 'sizeMB') {
                return sortConfig.direction === 'asc' 
                    ? a.sizeMB - b.sizeMB
                    : b.sizeMB - a.sizeMB;
            }
            if (sortConfig.key === 'created') {
                return sortConfig.direction === 'asc'
                    ? new Date(a.created) - new Date(b.created)
                    : new Date(b.created) - new Date(a.created);
            }
            return 0;
        });
        return sorted;
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '⇅';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    // Pagination
    const sortedBackups = sortData(backups);
    const totalPages = Math.ceil(sortedBackups.length / itemsPerPage);
    const paginatedBackups = sortedBackups.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-600">Cargando backups...</p>
            </div>
        </div>
    );

    return (
        <div className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h1 className="text-2xl font-bold">💾 Gestión de Backups</h1>
                <button 
                    onClick={handleCreateBackup}
                    disabled={creating}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {creating && <Spinner size="sm" />}
                    {creating ? 'Creando...' : '🔄 Crear Backup Ahora'}
                </button>
            </div>

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
                <h2 className="font-bold mb-2">ℹ️ Información</h2>
                <p className="text-sm text-gray-600">
                    Los backups se guardan en el servidor. Descargue los archivos .dump a su PC 
                    y guárdelos en un lugar seguro (Google Drive, USB, disco externo, etc.).
                </p>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th 
                                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                                    onClick={() => handleSort('filename')}
                                >
                                    Archivo {getSortIcon('filename')}
                                </th>
                                <th 
                                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                                    onClick={() => handleSort('sizeMB')}
                                >
                                    Tamaño {getSortIcon('sizeMB')}
                                </th>
                                <th 
                                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                                    onClick={() => handleSort('created')}
                                >
                                    Fecha de Creación {getSortIcon('created')}
                                </th>
                                <th className="px-4 py-2 text-left">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                        No hay backups disponibles
                                    </td>
                                </tr>
                            ) : (
                                paginatedBackups.map(backup => (
                                    <tr key={backup.filename} className="border-t hover:bg-gray-50">
                                        <td className="px-4 py-3">📦 {backup.filename}</td>
                                        <td className="px-4 py-3">{backup.sizeMB} MB</td>
                                        <td className="px-4 py-3">{backup.createdFormatted}</td>
                                        <td className="px-4 py-3">
                                            <button 
                                                onClick={() => handleDownload(backup.filename)}
                                                className="text-blue-600 hover:underline mr-2"
                                                title="Descargar a mi PC"
                                            >
                                                ⬇ Descargar
                                            </button>
                                            <button 
                                                onClick={() => openRestoreModal(backup.filename)}
                                                disabled={restoring}
                                                className="text-orange-600 hover:underline mr-2 disabled:opacity-50"
                                                title="Restaurar este backup"
                                            >
                                                {restoring && restoreModal.filename === backup.filename ? '🔄 Restaurando...' : '🔄 Restaurar'}
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(backup.filename)}
                                                className="text-red-600 hover:underline"
                                                title="Eliminar backup"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 py-4 border-t">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ← Anterior
                        </button>
                        <span className="px-3 py-1">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mt-4">
                <strong>⚠️ Advertencia:</strong> Restaurar un backup REEMPLAZA todos los datos actuales. 
                Se recomienda crear un backup antes de restaurar.
            </div>

            {/* Restore Confirmation Modal */}
            <ConfirmModal
                isOpen={restoreModal.open}
                title="Restaurar Backup"
                message={`¿Está seguro de restaurar el backup "${restoreModal.filename}"? Esto REEMPLAZARÁ todos los datos actuales.`}
                onConfirm={handleRestore}
                onCancel={() => setRestoreModal({ open: false, filename: '' })}
                confirmText="Restaurar"
                cancelText="Cancelar"
                danger={true}
            />
        </div>
    );
}
