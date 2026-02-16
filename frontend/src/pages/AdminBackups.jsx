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

// Modal component
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '450px' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? 'bg-[rgba(239,68,68,0.2)]' : 'bg-[rgba(99,102,241,0.2)]'}`}>
                        <span className="text-2xl">{danger ? '⚠️' : '❓'}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold m-0">{title}</h3>
                        <p className="text-[var(--text-secondary)] text-sm m-0">{message}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        onClick={onCancel}
                        className="btn btn-outline"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
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
        setDeleteModal({ open: true, filename });
    };

    const [deleteModal, setDeleteModal] = useState({ open: false, filename: '' });

    const confirmDelete = async () => {
        const filename = deleteModal.filename;
        setDeleteModal({ open: false, filename: '' });
        
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

    // Calculate total size
    const totalSizeMB = backups.reduce((acc, b) => acc + (b.sizeMB || 0), 0);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-[var(--text-secondary)]">Cargando backups...</p>
            </div>
        </div>
    );

    return (
        <div className="admin-page">
            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <h1 className="admin-title">
                        <span className="admin-title-icon">💾</span>
                        Gestión de Backups
                    </h1>
                    <p className="admin-subtitle">Administra los respaldos de la base de datos</p>
                </div>
                <button 
                    onClick={handleCreateBackup}
                    disabled={creating}
                    className="btn btn-primary"
                >
                    {creating ? <Spinner size="sm" /> : <span>🔄</span>}
                    {creating ? 'Creando...' : 'Crear Backup Ahora'}
                </button>
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

            {/* Stats Cards */}
            <div className="grid-3 mb-lg">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(99,102,241,0.2)] flex items-center justify-center">
                            <span className="text-xl">📦</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Total Backups</p>
                            <p className="text-xl font-bold m-0">{backups.length}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(16,185,129,0.2)] flex items-center justify-center">
                            <span className="text-xl">💿</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Tamaño Total</p>
                            <p className="text-xl font-bold m-0">{totalSizeMB.toFixed(2)} MB</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(245,158,11,0.2)] flex items-center justify-center">
                            <span className="text-xl">ℹ️</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Último Backup</p>
                            <p className="text-sm font-bold m-0">
                                {backups.length > 0 ? backups[0].createdFormatted : 'Sin backups'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="card mb-lg">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[rgba(99,102,241,0.2)] flex items-center justify-center flex-shrink-0">
                        <span>ℹ️</span>
                    </div>
                    <div>
                        <h4 className="font-bold mb-1">Información</h4>
                        <p className="text-[var(--text-secondary)] text-sm m-0">
                            Los backups se guardan en el servidor. Descargue los archivos .dump a su PC 
                            y guárdelos en un lugar seguro (Google Drive, USB, disco externo, etc.).
                        </p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th 
                                className="cursor-pointer hover:bg-[var(--bg-tertiary)]"
                                onClick={() => handleSort('filename')}
                            >
                                Archivo {getSortIcon('filename')}
                            </th>
                            <th 
                                className="cursor-pointer hover:bg-[var(--bg-tertiary)]"
                                onClick={() => handleSort('sizeMB')}
                            >
                                Tamaño {getSortIcon('sizeMB')}
                            </th>
                            <th 
                                className="cursor-pointer hover:bg-[var(--bg-tertiary)]"
                                onClick={() => handleSort('created')}
                            >
                                Fecha de Creación {getSortIcon('created')}
                            </th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {backups.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center text-[var(--text-muted)] py-8">
                                    No hay backups disponibles
                                </td>
                            </tr>
                        ) : (
                            paginatedBackups.map(backup => (
                                <tr key={backup.filename}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[rgba(99,102,241,0.2)] flex items-center justify-center">
                                                <span>📦</span>
                                            </div>
                                            <span className="font-medium">{backup.filename}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge badge-info">{backup.sizeMB} MB</span>
                                    </td>
                                    <td className="text-[var(--text-secondary)]">{backup.createdFormatted}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleDownload(backup.filename)}
                                                className="btn btn-outline btn-sm"
                                                title="Descargar a mi PC"
                                            >
                                                ⬇ Descargar
                                            </button>
                                            <button 
                                                onClick={() => openRestoreModal(backup.filename)}
                                                disabled={restoring}
                                                className="btn btn-outline btn-sm text-[var(--warning)]"
                                                title="Restaurar este backup"
                                            >
                                                {restoring && restoreModal.filename === backup.filename ? '🔄' : '🔄'}
                                                {restoring && restoreModal.filename === backup.filename ? 'Restaurando...' : 'Restaurar'}
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(backup.filename)}
                                                className="btn btn-outline btn-sm text-[var(--danger)]"
                                                title="Eliminar backup"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="pagination-btn"
                        >
                            ← Anterior
                        </button>
                        <span className="pagination-info">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="pagination-btn"
                        >
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>

            {/* Warning */}
            <div className="alert alert-warning mt-lg">
                <div className="flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <strong>Advertencia:</strong> Restaurar un backup REEMPLAZA todos los datos actuales. 
                        Se recomienda crear un backup antes de restaurar.
                    </div>
                </div>
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

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModal.open}
                title="Eliminar Backup"
                message={`¿Está seguro de eliminar el backup "${deleteModal.filename}"? Esta acción no se puede deshacer.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, filename: '' })}
                confirmText="Eliminar"
                cancelText="Cancelar"
                danger={true}
            />
        </div>
    );
}
