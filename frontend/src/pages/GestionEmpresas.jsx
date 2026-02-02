import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function GestionEmpresas() {
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showModal, setShowModal] = useState(false);
    const { isAdmin } = useAuth();

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        con_datos_prueba: false,
        admin_username: 'admin',
        admin_password: '',
        admin_nombre: 'Administrador'
    });

    useEffect(() => {
        loadEmpresas();
    }, []);

    const loadEmpresas = async () => {
        try {
            const response = await api.get('/empresas');
            setEmpresas(response.data);
        } catch (error) {
            setError('Error al cargar empresas: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // 1. Create company record
            const createResponse = await api.post('/empresas', formData);
            const empresaId = createResponse.data.empresa.id;

            setSuccess('Empresa creada en el registro. Iniciando creación de base de datos...');

            // 2. Create physical database
            await api.post(`/empresas/${empresaId}/crear-db`);

            setSuccess('¡Empresa y Base de Datos creadas exitosamente!');
            setShowModal(false);
            setFormData({
                nombre: '',
                descripcion: '',
                con_datos_prueba: false,
                admin_username: 'admin',
                admin_password: '',
                admin_nombre: 'Administrador'
            });
            loadEmpresas();
        } catch (error) {
            setError('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        return <div className="p-4 text-center">No tiene permisos para acceder a esta sección.</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Gestión de Empresas (Tenants)</h1>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowModal(true)}
                >
                    + Nueva Empresa
                </button>
            </div>

            {error && <div className="alert alert-danger mb-4">{error}</div>}
            {success && <div className="alert alert-success mb-4">{success}</div>}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base de Datos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creada</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {empresas.map((empresa) => (
                            <tr key={empresa.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium">{empresa.nombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{empresa.db_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${empresa.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {empresa.activo ? 'Activa' : 'Inactiva'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(empresa.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal para Nueva Empresa */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Nueva Empresa</h2>
                        <form onSubmit={handleCreateCompany}>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Nombre del Negocio</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        placeholder="Ej: Pet Shop El Amigo"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripción (Opcional)</label>
                                    <textarea
                                        className="form-input"
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2 mb-4">
                                    <input
                                        type="checkbox"
                                        id="testData"
                                        checked={formData.con_datos_prueba}
                                        onChange={(e) => setFormData({ ...formData, con_datos_prueba: e.target.checked })}
                                    />
                                    <label htmlFor="testData">Incluir datos de prueba</label>
                                </div>

                                <hr className="my-2" />
                                <h3 className="font-bold">Usuario Administrador</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Username</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            value={formData.admin_username}
                                            onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contraseña</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            required
                                            value={formData.admin_password}
                                            onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nombre Completo</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.admin_nombre}
                                        onChange={(e) => setFormData({ ...formData, admin_nombre: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowModal(false)}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Creando...' : 'Crear Empresa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
