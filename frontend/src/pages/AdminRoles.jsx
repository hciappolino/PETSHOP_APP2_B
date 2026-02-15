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

    const isModuleChecked = (modulePermisos) => {
        const ids = modulePermisos.map(p => p.id);
        const selected = ids.filter(id => selectedPermisos.includes(id));
        if (selected.length === 0) return false;
        if (selected.length === ids.length) return true;
        return 'partial';
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-600">Cargando roles y permisos...</p>
            </div>
        </div>
    );

    return (
        <div className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h1 className="text-2xl font-bold">🔐 Roles y Permisos</h1>
                <button 
                    onClick={handleNewRole}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                    + Nuevo Rol
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Roles List */}
                <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="font-bold mb-2">Roles</h2>
                    <div className="space-y-2">
                        {roles.map(rol => (
                            <div 
                                key={rol.id}
                                onClick={() => selectRole(rol)}
                                className={`p-2 rounded cursor-pointer flex justify-between items-center transition-colors ${
                                    selectedRole?.id === rol.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                                }`}
                            >
                                <span>{rol.nombre}</span>
                                {rol.es_sistema && <span className="text-xs bg-gray-200 px-1 rounded">🔒</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Permissions Panel */}
                <div className="md:col-span-3 bg-white rounded-lg shadow p-4">
                    {editingRole ? (
                        // Creating/editing role
                        <div>
                            <h2 className="font-bold mb-4">Crear Nuevo Rol</h2>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Nombre del Rol</label>
                                <input
                                    type="text"
                                    value={editingRole.nombre}
                                    onChange={(e) => setEditingRole({...editingRole, nombre: e.target.value})}
                                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="ej: Vendedor Senior"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Descripción</label>
                                <textarea
                                    value={editingRole.descripcion}
                                    onChange={(e) => setEditingRole({...editingRole, descripcion: e.target.value})}
                                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={2}
                                />
                            </div>
                            <h3 className="font-bold mb-2">Seleccionar Permisos:</h3>
                        </div>
                    ) : selectedRole ? (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                            <h2 className="font-bold">
                                Permisos de: {selectedRole.nombre}
                                {selectedRole.es_sistema && <span className="text-sm font-normal text-gray-500 ml-2">(Rol del sistema)</span>}
                            </h2>
                            {!selectedRole.es_sistema && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleEditRole}
                                        className="text-blue-600 hover:underline"
                                    >
                                        ✏️ Editar nombre
                                    </button>
                                    <button 
                                        onClick={handleDeleteRole}
                                        className="text-red-600 hover:underline"
                                    >
                                        🗑️ Eliminar
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500">Seleccione un rol para ver sus permisos</p>
                    )}

                    {(editingRole || selectedRole) && (
                        <div className="space-y-4">
                            {Object.entries(permisos.grouped).map(([modulo, moduloPermisos]) => {
                                const checked = isModuleChecked(moduloPermisos);
                                return (
                                    <div key={modulo} className="border rounded p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={checked === true}
                                                ref={el => { if (el) el.indeterminate = checked === 'partial'; }}
                                                onChange={(e) => toggleModule(moduloPermisos, e.target.checked)}
                                                className="w-4 h-4"
                                                disabled={selectedRole?.es_sistema}
                                            />
                                            <span className="font-medium uppercase">{modulo}</span>
                                        </div>
                                        <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {moduloPermisos.map(permiso => (
                                                <label key={permiso.id} className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPermisos.includes(permiso.id)}
                                                        onChange={() => togglePermiso(permiso.id)}
                                                        className="w-3 h-3"
                                                        disabled={selectedRole?.es_sistema}
                                                    />
                                                    <span>{permiso.nombre}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            <button 
                                onClick={handleSaveRole}
                                disabled={selectedRole?.es_sistema || saving}
                                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
