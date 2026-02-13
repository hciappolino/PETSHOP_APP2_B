import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export const Navbar = () => {
    const { user, logout, isAdmin, isGerente } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileOpenDropdowns, setMobileOpenDropdowns] = useState({});

    const handleLogout = () => {
        logout();
        setMobileMenuOpen(false);
        navigate('/login');
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
        setMobileOpenDropdowns({});
    };

    const toggleMobileDropdown = (key) => {
        setMobileOpenDropdowns(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isActive = (path) => location.pathname === path;

    // Usamos las variables del contexto para mayor seguridad
    const canSeeAll = isAdmin || isGerente;

    return (
        <>
            <nav className="navbar" onMouseLeave={() => setActiveDropdown(null)}>
                <div className="navbar-container">
                    <Link to="/" className="navbar-brand" onClick={() => { setActiveDropdown(null); closeMobileMenu(); }}>
                        <span className="brand-icon">🐾</span>
                        <div className="brand-text">
                            <span className="brand-name">Pet Shop</span>
                        </div>
                    </Link>

                    {/* Hamburger menu button */}
                    <button 
                        className="navbar-toggle" 
                        onClick={toggleMobileMenu}
                        aria-label="Menú"
                    >
                        <div className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </button>

                    {/* Desktop menu - hidden on mobile */}
                    <div className="navbar-menu">
                        {/* Acceso directo al POS como sección principal */}
                        <Link to="/pos" className={`nav-link ${isActive('/pos') ? 'active' : ''}`}>🛍️ POS</Link>

                        {/* MODULO VENTAS: opciones relacionadas (clientes, deudores, precios) */}
                        <div className="nav-item-dropdown" onMouseEnter={() => setActiveDropdown('ventas')}>
                            <span className={`nav-link ${activeDropdown === 'ventas' ? 'active' : ''}`}>
                                🛒 Ventas ▾
                            </span>
                            {activeDropdown === 'ventas' && (
                                <div className="dropdown-menu" onClick={() => setActiveDropdown(null)}>
                                    {canSeeAll && (
                                        <>
                                            <Link to="/clientes" className={isActive('/clientes') ? 'active' : ''}>👥 Clientes</Link>
                                            <Link to="/deudores" className={isActive('/deudores') ? 'active' : ''}>💳 Deudores</Link>
                                            <Link to="/precios" className={isActive('/precios') ? 'active' : ''}>🏷️ Precios</Link>
                                            <Link to="/promociones" className={isActive('/promociones') ? 'active' : ''}>🎁 Promociones</Link>
                                            <Link to="/ventas" className={isActive('/ventas') ? 'active' : ''}>📋 Listado de Ventas</Link>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* MODULO STOCK: Solo Admin/Gerente */}
                        {canSeeAll && (
                            <div className="nav-item-dropdown" onMouseEnter={() => setActiveDropdown('stock')}>
                                <span className={`nav-link ${activeDropdown === 'stock' ? 'active' : ''}`}>
                                    📦 Stock ▾
                                </span>
                                {activeDropdown === 'stock' && (
                                    <div className="dropdown-menu" onClick={() => setActiveDropdown(null)}>
                                        <Link to="/productos" className={isActive('/productos') ? 'active' : ''}>📦 Inventario</Link>
                                        <Link to="/movimientos-stock" className={isActive('/movimientos-stock') ? 'active' : ''}>🔄 Movimientos</Link>
                                        <Link to="/productos/ajuste" className={isActive('/productos/ajuste') ? 'active' : ''}>⚖️ Ajuste Stock</Link>
                                        <Link to="/inspeccion-granel" className={isActive('/inspeccion-granel') ? 'active' : ''}>🔍 Inspección Granel</Link>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MODULO COMPRAS: Solo Admin/Gerente */}
                        {canSeeAll && (
                            <div className="nav-item-dropdown" onMouseEnter={() => setActiveDropdown('compras')}>
                                <span className={`nav-link ${activeDropdown === 'compras' ? 'active' : ''}`}>
                                    📥 Compras ▾
                                </span>
                                {activeDropdown === 'compras' && (
                                    <div className="dropdown-menu" onClick={() => setActiveDropdown(null)}>
                                        <Link to="/proveedores" className={isActive('/proveedores') ? 'active' : ''}>🏭 Proveedores</Link>
                                        <Link to="/compras" className={isActive('/compras') ? 'active' : ''}>📥 Ingreso de Facturas</Link>
                                        <Link to="/compras/gastos" className={isActive('/compras/gastos') ? 'active' : ''}>🧾 Gastos/Servicios</Link>
                                        <Link to="/compras/listado" className={isActive('/compras/listado') ? 'active' : ''}>🧾 Listado de Compras</Link>
                                        <Link to="/compras/por-producto" className={isActive('/compras/por-producto') ? 'active' : ''}>🔎 Compras por Producto</Link>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MODULO FONDOS: Vendedor ve Caja, Admin ve todo */}
                        <div className="nav-item-dropdown" onMouseEnter={() => setActiveDropdown('fondos')}>
                            <span className={`nav-link ${activeDropdown === 'fondos' ? 'active' : ''}`}>
                                💰 Fondos ▾
                            </span>
                            {activeDropdown === 'fondos' && (
                                <div className="dropdown-menu" onClick={() => setActiveDropdown(null)}>
                                    {canSeeAll && <Link to="/fondos" className={isActive('/fondos') ? 'active' : ''}>💾 Cuentas</Link>}
                                    {canSeeAll && <Link to="/movimientos-fondos" className={isActive('/movimientos-fondos') ? 'active' : ''}>🔄 Movimientos</Link>}
                                    {canSeeAll && <Link to="/fondos/nuevo" className={isActive('/fondos/nuevo') ? 'active' : ''}>📝 Nuevo Comprobante</Link>}
                                    <Link to="/caja" className={isActive('/caja') ? 'active' : ''}>🏧 Caja</Link>
                                    <Link to="/reportes/caja-diaria" className={isActive('/reportes/caja-diaria') ? 'active' : ''}>📊 Reporte Caja</Link>
                                </div>
                            )}
                        </div>

                        {/* REPORTES: Solo Admin/Gerente */}
                        {canSeeAll && (
                            <div className="nav-item-dropdown" onMouseEnter={() => setActiveDropdown('reportes')}>
                                <span className={`nav-link ${activeDropdown === 'reportes' ? 'active' : ''}`}>
                                    📊 Reportes ▾
                                </span>
                                {activeDropdown === 'reportes' && (
                                    <div className="dropdown-menu" onClick={() => setActiveDropdown(null)}>
                                        <Link to="/reportes" className={isActive('/reportes') ? 'active' : ''}>📊 Dashboard</Link>
                                        <Link to="/reportes/ventas" className={isActive('/reportes/ventas') ? 'active' : ''}>💰 Ventas</Link>
                                        <Link to="/reportes/stock-minimo" className={isActive('/reportes/stock-minimo') ? 'active' : ''}>📉 Stock Bajo</Link>
                                        <Link to="/reportes/cliente-cc" className={isActive('/reportes/cliente-cc') ? 'active' : ''}>💳 Estado de Cuenta</Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="navbar-user">
                        <div className="flex flex-col items-end mr-md">
                            <span className="user-name">{user?.nombre}</span>
                            <span className="user-role-badge">{user?.rol}</span>
                        </div>
                        <button onClick={handleLogout} className="btn btn-sm btn-outline">
                            Salir
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile menu overlay */}
            <div 
                className={`mobile-menu-overlay ${mobileMenuOpen ? 'active' : ''}`} 
                onClick={closeMobileMenu}
            />

            {/* Mobile menu panel */}
            <div className={`mobile-menu ${mobileMenuOpen ? 'active' : ''}`}>
                <div className="mobile-menu-header">
                    <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
                        <span className="brand-icon">🐾</span>
                        <div className="brand-text">
                            <span className="brand-name">Pet Shop</span>
                        </div>
                    </Link>
                    <button className="mobile-menu-close" onClick={closeMobileMenu}>
                        ✕
                    </button>
                </div>

                <div className="mobile-nav-links">
                    {/* POS */}
                    <Link to="/pos" className={`mobile-nav-link ${isActive('/pos') ? 'active' : ''}`} onClick={closeMobileMenu}>
                        <span className="nav-icon">🛍️</span>
                        <span>POS</span>
                    </Link>

                    {/* Ventas dropdown */}
                    <div className={`mobile-dropdown ${mobileOpenDropdowns['ventas'] ? 'open' : ''}`}>
                        <div className="mobile-dropdown-trigger" onClick={() => toggleMobileDropdown('ventas')}>
                            <span>🛒 Ventas</span>
                            <span>{mobileOpenDropdowns['ventas'] ? '▲' : '▼'}</span>
                        </div>
                        {mobileOpenDropdowns['ventas'] && (
                            <div className="mobile-dropdown-menu">
                                {canSeeAll && (
                                    <>
                                        <Link to="/clientes" onClick={closeMobileMenu}>👥 Clientes</Link>
                                        <Link to="/deudores" onClick={closeMobileMenu}>💳 Deudores</Link>
                                        <Link to="/precios" onClick={closeMobileMenu}>🏷️ Precios</Link>
                                        <Link to="/promociones" onClick={closeMobileMenu}>🎁 Promociones</Link>
                                        <Link to="/ventas" onClick={closeMobileMenu}>📋 Listado de Ventas</Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stock dropdown - Admin/Gerente only */}
                    {canSeeAll && (
                        <div className={`mobile-dropdown ${mobileOpenDropdowns['stock'] ? 'open' : ''}`}>
                            <div className="mobile-dropdown-trigger" onClick={() => toggleMobileDropdown('stock')}>
                                <span>📦 Stock</span>
                                <span>{mobileOpenDropdowns['stock'] ? '▲' : '▼'}</span>
                            </div>
                            {mobileOpenDropdowns['stock'] && (
                                <div className="mobile-dropdown-menu">
                                    <Link to="/productos" onClick={closeMobileMenu}>📦 Inventario</Link>
                                    <Link to="/movimientos-stock" onClick={closeMobileMenu}>🔄 Movimientos</Link>
                                    <Link to="/productos/ajuste" onClick={closeMobileMenu}>⚖️ Ajuste Stock</Link>
                                    <Link to="/inspeccion-granel" onClick={closeMobileMenu}>🔍 Inspección Granel</Link>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Compras dropdown - Admin/Gerente only */}
                    {canSeeAll && (
                        <div className={`mobile-dropdown ${mobileOpenDropdowns['compras'] ? 'open' : ''}`}>
                            <div className="mobile-dropdown-trigger" onClick={() => toggleMobileDropdown('compras')}>
                                <span>📥 Compras</span>
                                <span>{mobileOpenDropdowns['compras'] ? '▲' : '▼'}</span>
                            </div>
                            {mobileOpenDropdowns['compras'] && (
                                <div className="mobile-dropdown-menu">
                                    <Link to="/proveedores" onClick={closeMobileMenu}>🏭 Proveedores</Link>
                                    <Link to="/compras" onClick={closeMobileMenu}>📥 Ingreso de Facturas</Link>
                                    <Link to="/compras/gastos" onClick={closeMobileMenu}>🧾 Gastos/Servicios</Link>
                                    <Link to="/compras/listado" onClick={closeMobileMenu}>🧾 Listado de Compras</Link>
                                    <Link to="/compras/por-producto" onClick={closeMobileMenu}>🔎 Compras por Producto</Link>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Fondos dropdown */}
                    <div className={`mobile-dropdown ${mobileOpenDropdowns['fondos'] ? 'open' : ''}`}>
                        <div className="mobile-dropdown-trigger" onClick={() => toggleMobileDropdown('fondos')}>
                            <span>💰 Fondos</span>
                            <span>{mobileOpenDropdowns['fondos'] ? '▲' : '▼'}</span>
                        </div>
                        {mobileOpenDropdowns['fondos'] && (
                            <div className="mobile-dropdown-menu">
                                {canSeeAll && <Link to="/fondos" onClick={closeMobileMenu}>💾 Cuentas</Link>}
                                {canSeeAll && <Link to="/movimientos-fondos" onClick={closeMobileMenu}>🔄 Movimientos</Link>}
                                {canSeeAll && <Link to="/fondos/nuevo" onClick={closeMobileMenu}>📝 Nuevo Comprobante</Link>}
                                <Link to="/caja" onClick={closeMobileMenu}>🏧 Caja</Link>
                                <Link to="/reportes/caja-diaria" onClick={closeMobileMenu}>📊 Reporte Caja</Link>
                            </div>
                        )}
                    </div>

                    {/* Reportes - Admin/Gerente only */}
                    {canSeeAll && (
                        <div className={`mobile-dropdown ${mobileOpenDropdowns['reportes'] ? 'open' : ''}`}>
                            <div className="mobile-dropdown-trigger" onClick={() => toggleMobileDropdown('reportes')}>
                                <span>📊 Reportes</span>
                                <span>{mobileOpenDropdowns['reportes'] ? '▲' : '▼'}</span>
                            </div>
                            {mobileOpenDropdowns['reportes'] && (
                                <div className="mobile-dropdown-menu">
                                    <Link to="/reportes" onClick={closeMobileMenu}>📊 Dashboard</Link>
                                    <Link to="/reportes/ventas" onClick={closeMobileMenu}>💰 Ventas</Link>
                                    <Link to="/reportes/stock-minimo" onClick={closeMobileMenu}>📉 Stock Bajo</Link>
                                    <Link to="/reportes/cliente-cc" onClick={closeMobileMenu}>💳 Estado de Cuenta</Link>
                                </div>
                            )}
                        </div>
                    )}

                    {/* User info */}
                    <div className="mobile-user-info">
                        <div className="flex flex-col">
                            <span className="user-name">{user?.nombre}</span>
                            <span className="user-role-badge">{user?.rol}</span>
                        </div>
                        <button onClick={handleLogout} className="btn btn-primary w-full mt-md" style={{ marginTop: 'var(--spacing-md)' }}>
                            Salir
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
