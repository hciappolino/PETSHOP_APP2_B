import { useState, useEffect } from 'react';
import api from '../api';

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

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este usuario?')) return;
        
        try {
            await api.delete(`/usuarios/${id}`);
            setSuccess('Usuario eliminado correctamente');
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar usuario');
        }
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

    if (loading) return <div className="p-4">Cargando...</div>;

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">👤 Gestión de Usuarios</h1>
                <button 
                    onClick={openNewUser}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    + Nuevo Usuario
                </button>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 mb-4 rounded">{error}</div>}
            {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 mb-4 rounded">{success}</div>}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-2 text-left">Usuario</th>
                            <th className="px-4 py-2 text-left">Nombre</th>
                            <th className="px-4 py-2 text-left">Email</th>
                            <th className="px-4 py-2 text-left">Rol</th>
                            <th className="px-4 py-2 text-left">Estado</th>
                            <th className="px-4 py-2 text-left">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(user => (
                            <tr key={user.id} className="border-t">
                                <td className="px-4 py-2">{user.username}</td>
                                <td className="px-4 py-2">{user.nombre}</td>
                                <td className="px-4 py-2">{user.email || '-'}</td>
                                <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded text-sm ${
                                        user.rol_id === 1 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        {getRoleName(user.rol_id)}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <span className={user.activo ? 'text-green-600' : 'text-red-600'}>
                                        {user.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <button 
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:underline mr-2"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-600 hover:underline"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Usuario</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                                    className="w-full border rounded px-3 py-2"
                                    required
                                    disabled={editingUser}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                                    className="w-full border rounded px-3 py-2"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="w-full border rounded px-3 py-2"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">
                                    Contraseña {editingUser && '(dejar vacío para mantener)'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    className="w-full border rounded px-3 py-2"
                                    required={!editingUser}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Rol</label>
                                <select
                                    value={formData.rol_id}
                                    onChange={(e) => setFormData({...formData, rol_id: parseInt(e.target.value)})}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    {roles.map(rol => (
                                        <option key={rol.id} value={rol.id}>
                                            {rol.nombre} {rol.es_sistema && '(Sistema)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                                        className="mr-2"
                                    />
                                    Usuario activo
                                </label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingUser(null); }}
                                    className="px-4 py-2 border rounded hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
