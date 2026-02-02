import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export const Navbar = () => {
    const { user, logout, isAdmin, isGerente } = useAuth();
    const navigate = useNavigate();
    const [activeDropdown, setActiveDropdown] = useState(null);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Usamos las variables del contexto para mayor seguridad
    const canSeeAll = isAdmin || isGerente;

    return (
        <nav className="navbar" onMouseLeave={() => setActiveDropdown(null)}>
            <div className="navbar-container">
                <Link to="/" className="navbar-brand" onClick={() => setActiveDropdown(null)}>
                    <span className="brand-icon">🐾</span>
                    <div className="brand-text">
                        <span className="brand-name">Pet Shop</span>
                    </div>
                </Link>

                <div className="navbar-menu">
                    {/* Acceso directo al POS como sección principal */}
                    <Link to="/pos" className="nav-link">🛍️ POS</Link>

                    {/* MODULO VENTAS: opciones relacionadas (clientes, deudores, precios) */}
                    <div className="nav-item-dropdown" onMouseEnter={() => setActiveDropdown('ventas')}>
                        <span className={`nav-link ${activeDropdown === 'ventas' ? 'active' : ''}`}>
                            🛒 Ventas ▾
                        </span>
                        {activeDropdown === 'ventas' && (
                            <div className="dropdown-menu" onClick={() => setActiveDropdown(null)}>
                                {canSeeAll && (
                                    <>
                                        <Link to="/clientes">👥 Clientes</Link>
                                        <Link to="/deudores">💳 Deudores</Link>
                                        <Link to="/precios">🏷️ Precios</Link>
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
                                    <Link to="/productos">📦 Inventario</Link>
                                    <Link to="/movimientos-stock">🔄 Movimientos</Link>
                                    <Link to="/productos/ajuste">⚖️ Ajuste Stock</Link>
                                    <Link to="/inspeccion-granel">🔍 Inspección Granel</Link>
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
                                    <Link to="/proveedores">🏭 Proveedores</Link>
                                    <Link to="/compras">📥 Ingreso de Facturas</Link>
                                    <Link to="/compras/listado">🧾 Listado de Compras</Link>
                                    <Link to="/compras/por-producto">🔎 Compras por Producto</Link>
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
                                {canSeeAll && <Link to="/fondos">💾 Cuentas</Link>}
                                {canSeeAll && <Link to="/movimientos-fondos">🔄 Movimientos</Link>}
                                {canSeeAll && <Link to="/fondos/nuevo">📝 Nuevo Comprobante</Link>}
                                <Link to="/caja">🏧 Caja</Link>
                            </div>
                        )}
                    </div>

                    {/* REPORTES: Solo Admin/Gerente */}
                    {canSeeAll && (
                        <Link to="/reportes" className="nav-link">📊 Reportes</Link>
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
    );
};