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
import ReporteVentasMensuales from './pages/ReporteVentasMensuales';
import ReporteStockMinimo from './pages/ReporteStockMinimo';
import ReporteClienteCC from './pages/ReporteClienteCC';
import ReporteCajaDiaria from './pages/ReporteCajaDiaria';

// Admin Pages (to be created in Phase 9)
import AdminUsuarios from './pages/AdminUsuarios';
import AdminRoles from './pages/AdminRoles';
import AdminBackups from './pages/AdminBackups';
import AdminBaseDatos from './pages/AdminBaseDatos';

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
                    <ProtectedRoute requiredPermission="admin.empresas">
                        <GestionEmpresas />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/productos"
                element={
                    <ProtectedRoute requiredPermission="productos.ver">
                        <Productos />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/clientes"
                element={
                    <ProtectedRoute requiredPermission="clientes.ver">
                        <Clientes />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/deudores"
                element={
                    <ProtectedRoute requiredPermission="clientes.cc">
                        <Deudores />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/proveedores"
                element={
                    <ProtectedRoute requiredPermission="proveedores.ver">
                        <Proveedores />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras"
                element={
                    <ProtectedRoute requiredPermission="compras.ver">
                        <Compras />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras/listado"
                element={
                    <ProtectedRoute requiredPermission="compras.ver">
                        <ComprasListado />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras/por-producto"
                element={
                    <ProtectedRoute requiredPermission="compras.ver">
                        <ComprasPorProducto />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/compras/gastos"
                element={
                    <ProtectedRoute requiredPermission="compras.gastos">
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
                    <ProtectedRoute requiredPermission="fondos.ver">
                        <Fondos />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/fondos/nuevo"
                element={
                    <ProtectedRoute requiredPermission="fondos.mover">
                        <FondosNuevo />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/precios"
                element={
                    <ProtectedRoute requiredPermission="precios.ver">
                        <Precios />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/promociones"
                element={
                    <ProtectedRoute requiredPermission="promociones.ver">
                        <Promociones />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes"
                element={
                    <ProtectedRoute requiredPermission="reportes.ventas">
                        <Reportes />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/ventas"
                element={
                    <ProtectedRoute requiredPermission="reportes.ventas">
                        <ReporteVentas />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/ventas-mensuales"
                element={
                    <ProtectedRoute requiredPermission="reportes.ventas">
                        <ReporteVentasMensuales />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/stock-minimo"
                element={
                    <ProtectedRoute requiredPermission="reportes.stock">
                        <ReporteStockMinimo />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/cliente-cc"
                element={
                    <ProtectedRoute requiredPermission="clientes.cc">
                        <ReporteClienteCC />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/reportes/caja-diaria"
                element={
                    <ProtectedRoute requiredPermission="caja.reportes">
                        <ReporteCajaDiaria />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/movimientos-stock"
                element={
                    <ProtectedRoute requiredPermission="stock.ver">
                        <MovimientosStock />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/movimientos-fondos"
                element={
                    <ProtectedRoute requiredPermission="fondos.ver">
                        <MovimientosFondos />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/productos/ajuste"
                element={
                    <ProtectedRoute requiredPermission="stock.ajustar">
                        <StockAjuste />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/inspeccion-granel"
                element={
                    <ProtectedRoute requiredPermission="stock.granel">
                        <InspeccionGranel />
                    </ProtectedRoute>
                }
            />

            {/* Legacy route - now redirects to admin base-datos */}
            <Route
                path="/init-db"
                element={
                    <ProtectedRoute requiredPermission="admin.initdb">
                        <InitDB />
                    </ProtectedRoute>
                }
            />
            
            <Route
                path="/ventas"
                element={
                    <ProtectedRoute requiredPermission="ventas.ver">
                        <VentasListado />
                    </ProtectedRoute>
                }
            />

            {/* ADMIN ROUTES - require admin.usuarios permission */}
            <Route
                path="/admin/usuarios"
                element={
                    <ProtectedRoute requiredPermission="admin.usuarios">
                        <AdminUsuarios />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/roles"
                element={
                    <ProtectedRoute requiredPermission="admin.roles">
                        <AdminRoles />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/backups"
                element={
                    <ProtectedRoute requiredPermission="admin.backups">
                        <AdminBackups />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/base-datos"
                element={
                    <ProtectedRoute requiredPermission="admin.initdb">
                        <AdminBaseDatos />
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
