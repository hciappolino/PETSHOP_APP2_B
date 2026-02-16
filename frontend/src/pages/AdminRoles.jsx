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
                        <span className="text-2xl">{danger ? '!' : '?'}</span>
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

// Permission Card Component
const PermissionCard = ({ modulo, permisos, selectedPermisos, onTogglePermiso, onToggleModule, disabled }) => {
    const allIds = permisos.map(p => p.id);
    const selectedCount = allIds.filter(id => selectedPermisos.includes(id)).length;
    const totalCount = allIds.length;
    const isAllSelected = selectedCount === totalCount;
    const isPartial = selectedCount > 0 && selectedCount < totalCount;

    // Icon mapping for modules
    const moduleIcons = {
        'dashboard': 'chart',
        'ventas': 'cart',
        'productos': 'box',
        'clientes': 'users',
        'compras': 'truck',
        'proveedores': 'building',
        'stock': 'package',
        'caja': 'cash',
        'fondos': 'wallet',
        'reportes': 'chart-bar',
        'usuarios': 'user-cog',
        'roles': 'shield',
        'promociones': 'tag',
        'precios': 'price',
        'backup': 'database',
        'sistema': 'settings'
    };

    const getModuleIcon = (name) => {
        const key = name.toLowerCase();
        return moduleIcons[key] || 'key';
    };

    return (
        <div className="permission-card">
            <div className="permission-header" onClick={() => onToggleModule(permisos, !isAllSelected)}>
                <div className="permission-header-left">
                    <div className="module-icon">
                        {getModuleIcon(modulo) === 'chart' && 'chart'}
                        {getModuleIcon(modulo) === 'cart' && 'cart'}
                        {getModuleIcon(modulo) === 'box' && 'box'}
                        {getModuleIcon(modulo) === 'users' && 'users'}
                        {getModuleIcon(modulo) === 'truck' && 'truck'}
                        {getModuleIcon(modulo) === 'building' && 'building'}
                        {getModuleIcon(modulo) === 'package' && 'package'}
                        {getModuleIcon(modulo) === 'cash' && 'cash'}
                        {getModuleIcon(modulo) === 'wallet' && 'wallet'}
                        {getModuleIcon(modulo) === 'chart-bar' && 'chart-bar'}
                        {getModuleIcon(modulo) === 'user-cog' && 'user-cog'}
                        {getModuleIcon(modulo) === 'shield' && 'shield'}
                        {getModuleIcon(modulo) === 'tag' && 'tag'}
                        {getModuleIcon(modulo) === 'price' && 'price'}
                        {getModuleIcon(modulo) === 'database' && 'database'}
                        {getModuleIcon(modulo) === 'settings' && 'settings'}
                        {getModuleIcon(modulo) === 'key' && 'key'}
                    </div>
                    <div>
                        <h4 className="module-name">{modulo}</h4>
                        <span className="permission-count">{selectedCount}/{totalCount} permisos</span>
                    </div>
                </div>
                <div className="permission-header-right">
                    <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={el => { if (el) el.indeterminate = isPartial; }}
                            onChange={(e) => onToggleModule(permisos, e.target.checked)}
                            disabled={disabled}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
            </div>
            <div className="permission-body">
                <div className="permission-grid">
                    {permisos.map(permiso => (
                        <label key={permiso.id} className={`permission-item ${selectedPermisos.includes(permiso.id) ? 'selected' : ''}`}>
                            <input
                                type="checkbox"
                                checked={selectedPermisos.includes(permiso.id)}
                                onChange={() => onTogglePermiso(permiso.id)}
                                disabled={disabled}
                            />
                            <span className="permission-checkmark"></span>
                            <span className="permission-label">{permiso.nombre}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function AdminRoles() {
    const [roles, setRoles] = useState([]);
    const [permisos, setPermisos] = useState({ permisos: [], grouped: {} });
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [selectedPermisos, setSelectedPermisos] = useState([]);
    const [roleForm, setRoleForm] = useState({ nombre: '', descripcion: '' });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, role: null });

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
            const [rolesRes, permisosRes] = await Promise.all([
                api.get('/roles'),
                api.get('/roles/permisos/all')
            ]);
            setRoles(rolesRes.data);
            setPermisos(permisosRes.data);
            if (rolesRes.data.length > 0) {
                selectRole(rolesRes.data[0]);
            }
        } catch (err) {
            setError('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const selectRole = async (role) => {
        setSelectedRole(role);
        setEditingRole(null);
        
        try {
            const res = await api.get(`/roles/${role.id}`);
            const rolePermisos = res.data.permisos || [];
            setSelectedPermisos(rolePermisos.map(p => p.id));
        } catch (err) {
            setSelectedPermisos([]);
        }
    };

    const handleNewRole = () => {
        setSelectedRole(null);
        setEditingRole({ nombre: '', descripcion: '' });
        setSelectedPermisos([]);
    };

    const handleEditRole = () => {
        if (!selectedRole || selectedRole.es_sistema) return;
        setEditingRole({
            nombre: selectedRole.nombre,
            descripcion: selectedRole.descripcion || ''
        });
    };

    const handleSaveRole = async () => {
        setError(null);
        setSaving(true);
        
        try {
            if (selectedRole && !editingRole) {
                // Update permissions only
                await api.put(`/roles/${selectedRole.id}`, {
                    permisos: selectedPermisos
                });
                setSuccess('Permisos actualizados correctamente');
            } else if (editingRole) {
                // Create new role
                const res = await api.post('/roles', {
                    ...editingRole,
                    permisos: selectedPermisos
                });
                setSuccess('Rol creado correctamente');
                loadData();
                setEditingRole(null);
            }
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar rol');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!selectedRole || selectedRole.es_sistema) return;
        setDeleteModal({ open: true, role: selectedRole });
    };

    const confirmDelete = async () => {
        const role = deleteModal.role;
        setDeleteModal({ open: false, role: null });
        
        try {
            await api.delete(`/roles/${role.id}`);
            setSuccess('Rol eliminado correctamente');
            setSelectedRole(null);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar rol');
        }
    };

    const togglePermiso = (permisoId) => {
        setSelectedPermisos(prev => {
            if (prev.includes(permisoId)) {
                return prev.filter(id => id !== permisoId);
            }
            return [...prev, permisoId];
        });
    };

    const toggleModule = (modulePermisos, checkAll) => {
        const ids = modulePermisos.map(p => p.id);
        setSelectedPermisos(prev => {
            if (checkAll) {
                // Add all from module
                const newSet = new Set([...prev, ...ids]);
                return Array.from(newSet);
            } else {
                // Remove all from module
                return prev.filter(id => !ids.includes(id));
            }
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-[var(--text-secondary)]">Cargando roles y permisos...</p>
            </div>
        </div>
    );

    return (
        <div className="admin-page">
            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <h1 className="admin-title">
                        <span className="admin-title-icon">shield</span>
                        Roles y Permisos
                    </h1>
                    <p className="admin-subtitle">Gestiona los roles y sus permisos asociados</p>
                </div>
                <button 
                    onClick={handleNewRole}
                    className="btn btn-primary"
                >
                    <span>+</span> Nuevo Rol
                </button>
            </div>

            {/* Messages */}
            {error && (
                <div className="alert alert-error">
                    <span className="alert-icon">!</span>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="alert-close">×</button>
                </div>
            )}
            {success && (
                <div className="alert alert-success">
                    <span className="alert-icon">ok</span>
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="alert-close">×</button>
                </div>
            )}

            <div className="admin-grid">
                {/* Roles List */}
                <div className="roles-panel">
                    <div className="panel-header">
                        <h2 className="panel-title">Roles</h2>
                        <span className="panel-badge">{roles.length}</span>
                    </div>
                    <div className="roles-list">
                        {roles.map(rol => (
                            <div 
                                key={rol.id}
                                onClick={() => selectRole(rol)}
                                className={`role-item ${selectedRole?.id === rol.id ? 'active' : ''}`}
                            >
                                <div className="role-item-left">
                                    <div className="role-avatar">
                                        {rol.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="role-name">{rol.nombre}</span>
                                        {rol.descripcion && (
                                            <span className="role-desc">{rol.descripcion}</span>
                                        )}
                                    </div>
                                </div>
                                {rol.es_sistema && <span className="system-badge">Sistema</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Permissions Panel */}
                <div className="permissions-panel">
                    {editingRole ? (
                        // Creating/editing role
                        <div className="edit-form-container">
                            <div className="edit-form-header">
                                <h2 className="panel-title">Crear Nuevo Rol</h2>
                            </div>
                            <div className="edit-form-body">
                                <div className="form-group">
                                    <label className="form-label">
                                        <span className="label-icon">user</span>
                                        Nombre del Rol
                                    </label>
                                    <input
                                        type="text"
                                        value={editingRole.nombre}
                                        onChange={(e) => setEditingRole({...editingRole, nombre: e.target.value})}
                                        className="form-input"
                                        placeholder="ej: Vendedor Senior"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <span className="label-icon">text</span>
                                        Descripción
                                    </label>
                                    <textarea
                                        value={editingRole.descripcion}
                                        onChange={(e) => setEditingRole({...editingRole, descripcion: e.target.value})}
                                        className="form-textarea"
                                        rows={2}
                                        placeholder="Describe el rol y sus responsabilidades..."
                                    />
                                </div>
                                <h3 className="section-title">
                                    <span className="section-icon">key</span>
                                    Asignar Permisos
                                </h3>
                            </div>
                        </div>
                    ) : selectedRole ? (
                        <div className="selected-role-header">
                            <div className="selected-role-info">
                                <div className="selected-role-avatar">
                                    {selectedRole.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="selected-role-name">
                                        {selectedRole.nombre}
                                    </h2>
                                    {selectedRole.es_sistema && (
                                        <span className="system-role-badge">Rol del sistema - solo lectura</span>
                                    )}
                                </div>
                            </div>
                            {!selectedRole.es_sistema && (
                                <div className="role-actions">
                                    <button 
                                        onClick={handleEditRole}
                                        className="btn btn-outline btn-sm"
                                    >
                                        <span>edit</span> Editar nombre
                                    </button>
                                    <button 
                                        onClick={handleDeleteRole}
                                        className="btn btn-danger btn-sm"
                                    >
                                        <span>trash</span> Eliminar
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">shield</div>
                            <p>Seleccione un rol para ver sus permisos</p>
                        </div>
                    )}

                    {(editingRole || selectedRole) && (
                        <div className="permissions-grid">
                            {Object.entries(permisos.grouped).map(([modulo, moduloPermisos]) => (
                                <PermissionCard
                                    key={modulo}
                                    modulo={modulo}
                                    permisos={moduloPermisos}
                                    selectedPermisos={selectedPermisos}
                                    onTogglePermiso={togglePermiso}
                                    onToggleModule={toggleModule}
                                    disabled={selectedRole?.es_sistema}
                                />
                            ))}
                        </div>
                    )}

                    {(editingRole || selectedRole) && !selectedRole?.es_sistema && (
                        <div className="save-actions">
                            <button 
                                onClick={handleSaveRole}
                                disabled={saving}
                                className="btn btn-primary btn-lg"
                            >
                                {saving && <Spinner size="sm" />}
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModal.open}
                title="Eliminar Rol"
                message={`¿Está seguro de eliminar el rol "${deleteModal.role?.nombre}"? Esta acción no se puede deshacer.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, role: null })}
                confirmText="Eliminar"
                cancelText="Cancelar"
                danger={true}
            />
        </div>
    );
}
