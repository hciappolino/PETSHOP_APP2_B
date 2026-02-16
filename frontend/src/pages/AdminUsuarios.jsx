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

export default function AdminUsuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        nombre: '',
        email: '',
        password: '',
        rol_id: 2,
        activo: true
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // Search and pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    
    // Delete modal
    const [deleteModal, setDeleteModal] = useState({ open: false, user: null });

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
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([
                api.get('/usuarios'),
                api.get('/roles')
            ]);
            setUsuarios(usersRes.data);
            setRoles(rolesRes.data);
        } catch (err) {
            setError('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        
        try {
            if (editingUser) {
                await api.put(`/usuarios/${editingUser.id}`, formData);
                setSuccess('Usuario actualizado correctamente');
            } else {
                await api.post('/usuarios', formData);
                setSuccess('Usuario creado correctamente');
            }
            setShowModal(false);
            setEditingUser(null);
            resetForm();
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar usuario');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            nombre: user.nombre,
            email: user.email || '',
            password: '',
            rol_id: user.rol_id,
            activo: user.activo
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        const user = deleteModal.user;
        setDeleteModal({ open: false, user: null });
        
        try {
            await api.delete(`/usuarios/${user.id}`);
            setSuccess('Usuario eliminado correctamente');
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar usuario');
        }
    };

    const openDeleteModal = (user) => {
        setDeleteModal({ open: true, user });
    };

    const resetForm = () => {
        setFormData({
            username: '',
            nombre: '',
            email: '',
            password: '',
            rol_id: 2,
            activo: true
        });
    };

    const openNewUser = () => {
        setEditingUser(null);
        resetForm();
        setShowModal(true);
    };

    const getRoleName = (rolId) => {
        const rol = roles.find(r => r.id === rolId);
        return rol ? rol.nombre : 'Desconocido';
    };

    const getRoleBadgeClass = (rolId) => {
        return rolId === 1 ? 'badge-danger' : 'badge-info';
    };

    // Filter users by search
    const filteredUsuarios = usuarios.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Pagination
    const totalPages = Math.ceil(filteredUsuarios.length / itemsPerPage);
    const paginatedUsuarios = filteredUsuarios.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-[var(--text-secondary)]">Cargando usuarios...</p>
            </div>
        </div>
    );

    return (
        <div className="admin-page">
            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <h1 className="admin-title">
                        <span className="admin-title-icon">👤</span>
                        Gestión de Usuarios
                    </h1>
                    <p className="admin-subtitle">Administra los usuarios del sistema y sus roles</p>
                </div>
                <button 
                    onClick={openNewUser}
                    className="btn btn-primary"
                >
                    <span>+</span> Nuevo Usuario
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
                            <span className="text-xl">👥</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Total Usuarios</p>
                            <p className="text-xl font-bold m-0">{usuarios.length}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(16,185,129,0.2)] flex items-center justify-center">
                            <span className="text-xl">✅</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Activos</p>
                            <p className="text-xl font-bold m-0">{usuarios.filter(u => u.activo).length}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(239,68,68,0.2)] flex items-center justify-center">
                            <span className="text-xl">⏸️</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-muted)] text-sm m-0">Inactivos</p>
                            <p className="text-xl font-bold m-0">{usuarios.filter(u => !u.activo).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="card mb-lg">
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Buscar por nombre, usuario o email..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedUsuarios.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center text-[var(--text-muted)] py-8">
                                    {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios disponibles'}
                                </td>
                            </tr>
                        ) : (
                            paginatedUsuarios.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="role-avatar">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium">{user.username}</span>
                                        </div>
                                    </td>
                                    <td>{user.nombre}</td>
                                    <td className="text-[var(--text-muted)]">{user.email || '-'}</td>
                                    <td>
                                        <span className={`badge ${getRoleBadgeClass(user.rol_id)}`}>
                                            {getRoleName(user.rol_id)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`flex items-center ${user.activo ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            <span className={`status-dot ${user.activo ? 'status-active' : 'status-inactive'}`}></span>
                                            {user.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleEdit(user)}
                                                className="btn btn-outline btn-sm"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => openDeleteModal(user)}
                                                className="btn btn-outline btn-sm text-[var(--danger)]"
                                                title="Eliminar"
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

            {/* User Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2 className="text-xl font-bold mb-4">
                            {editingUser ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Usuario</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                                    className="form-input"
                                    required
                                    disabled={editingUser}
                                    placeholder="Nombre de usuario"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nombre</label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                                    className="form-input"
                                    required
                                    placeholder="Nombre completo"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="form-input"
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    Contraseña {editingUser && <span className="text-[var(--text-muted)]">(dejar vacío para mantener)</span>}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    className="form-input"
                                    required={!editingUser}
                                    placeholder={editingUser ? '••••••••' : 'Contraseña'}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rol</label>
                                <select
                                    value={formData.rol_id}
                                    onChange={(e) => setFormData({...formData, rol_id: parseInt(e.target.value)})}
                                    className="form-select"
                                >
                                    {roles.map(rol => (
                                        <option key={rol.id} value={rol.id}>
                                            {rol.nombre} {rol.es_sistema && '(Sistema)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                                        className="w-5 h-5"
                                    />
                                    <span>Usuario activo</span>
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingUser(null); }}
                                    className="btn btn-outline"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModal.open}
                title="Eliminar Usuario"
                message={`¿Está seguro de eliminar el usuario "${deleteModal.user?.username}"? Esta acción no se puede deshacer.`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteModal({ open: false, user: null })}
                confirmText="Eliminar"
                cancelText="Cancelar"
                danger={true}
            />
        </div>
    );
}
