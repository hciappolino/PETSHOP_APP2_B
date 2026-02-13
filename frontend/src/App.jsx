import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Productos from './pages/Productos';
import Clientes from './pages/Clientes';
import Deudores from './pages/Deudores';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import ComprasListado from './pages/ComprasListado';
import ComprasPorProducto from './pages/ComprasPorProducto';
import Gastos from './pages/Gastos';
import POS from './pages/POS';
import Caja from './pages/Caja';
import Precios from './pages/Precios';
import Reportes from './pages/Reportes';
import Fondos from './pages/Fondos';
import FondosNuevo from './pages/FondosNuevo';
import MovimientosFondos from './pages/MovimientosFondos';
import StockAjuste from './pages/StockAjuste';
import MovimientosStock from './pages/MovimientosStock';
import GestionEmpresas from './pages/GestionEmpresas';
import InspeccionGranel from './pages/InspeccionGranel';
import InitDB from './pages/InitDB';
import Promociones from './pages/Promociones';
import VentasListado from './pages/VentasListado';
import ReporteVentas from './pages/ReporteVentas';
import ReporteStockMinimo from './pages/ReporteStockMinimo';
import ReporteClienteCC from './pages/ReporteClienteCC';
import ReporteCajaDiaria from './pages/ReporteCajaDiaria';

// Componente para manejar la redirección de la raíz
function RootRedirect() {
    const { user, isVendedor } = useAuth();
    
    // Aseguramos que user esté cargado antes de redirigir
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    
    // Si es vendedor, redirigir a POS
    if (isVendedor) {
        return <Navigate to="/pos" replace />;
    }
    
    // Si es admin o gerente, mostrar Dashboard
    return <Dashboard />;
}

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route
                path="/login"
                element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
            />

            {/* RUTA RAÍZ: Redirección automática según el ROL */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <RootRedirect />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/empresas"
                element={
                    <ProtectedRoute allowedRoles={['admin']}>
                        <GestionEmpresas />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/productos"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Productos />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/clientes"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Clientes />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/deudores"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Deudores />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/proveedores"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Proveedores />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Compras />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras/listado"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <ComprasListado />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras/por-producto"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <ComprasPorProducto />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras/gastos"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Gastos />
                    </ProtectedRoute>
                }
            />

            {/* Rutas accesibles para todos los usuarios autenticados */}
            <Route
                path="/pos"
                element={
                    <ProtectedRoute>
                        <POS />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/caja"
                element={
                    <ProtectedRoute>
                        <Caja />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/fondos"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Fondos />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/fondos/nuevo"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <FondosNuevo />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/precios"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Precios />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/promociones"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Promociones />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <Reportes />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/ventas"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <ReporteVentas />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/stock-minimo"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <ReporteStockMinimo />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/cliente-cc"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <ReporteClienteCC />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/caja-diaria"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <ReporteCajaDiaria />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/movimientos-stock"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <MovimientosStock />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/movimientos-fondos"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <MovimientosFondos />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/productos/ajuste"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <StockAjuste />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/inspeccion-granel"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <InspeccionGranel />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/init-db"
                element={<InitDB />}
            />
            
            <Route
                path="/ventas"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                        <VentasListado />
                    </ProtectedRoute>
                }
            />

            {/* Redirección por defecto para cualquier ruta no encontrada */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </AuthProvider>
    );
}

function AppContent() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="app">
            {/* El Navbar mostrará u ocultará opciones según el rol del usuario */}
            {isAuthenticated && <Navbar />}
            <main className="main-content">
                <AppRoutes />
            </main>
        </div>
    );
}

export default App;
