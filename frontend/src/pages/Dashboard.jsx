import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Dashboard.css';

export default function Dashboard() {
    const { user, isVendedor } = useAuth();
    const [stats, setStats] = useState({
        productosTotal: 0,
        productosBajoStock: 0,
        sesionCajaAbierta: false,
        ventasHoy: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // Load products (allowed for all)
            const productosRes = await api.get('/productos');
            let productosBajoRes = { data: [] };

            // Only try stock-bajo if not vendedor (or if role allows)
            if (!isVendedor) {
                try {
                    productosBajoRes = await api.get('/reportes/stock-bajo');
                } catch (e) {
                    console.warn('Could not load low stock report:', e.message);
                }
            }

            // Correct route: /sesiones-caja/current
            const sesionRes = await api.get('/sesiones-caja/current');
            const sesionData = sesionRes.data;

            // Calcular valor del stock a precio de venta (solo productos con stock > 0)
            const valorStockVenta = productosRes.data
                .filter(p => parseFloat(p.stock_actual || 0) > 0)
                .reduce((acc, p) => {
                    const qty = parseFloat(p.stock_actual || 0) || 0;
                    const precioVenta = parseFloat(p.precio_venta_unidad || p.precio_venta || p.precio || 0) || 0;
                    return acc + qty * precioVenta;
                }, 0);

            setStats({
                productosTotal: productosRes.data.length,
                productosBajoStock: productosBajoRes.data.length,
                sesionCajaAbierta: !!sesionData,
                // If there's an open session, we could show more info, 
                // but for now we keep it simple or use a default
                ventasHoy: sesionData ? 'Activa' : 'Sin sesión',
                valorStockVenta
            });
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
        );
    }

    return (
        <div className="container dashboard">
            <div className="dashboard-header-container">
                <div className="dashboard-header">
                    <h1>Bienvenido, {user?.nombre}</h1>
                    <p className="text-secondary">Panel de control del sistema</p>
                </div>
                {user?.empresa && (
                    <div className="company-indicator">
                        <span className="indicator-label">🏢 EMPRESA ACTIVA</span>
                        <h2 className="company-name">{user.empresa}</h2>
                        <span className="db-badge">{user.db_name}</span>
                    </div>
                )}
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <span style={{ fontSize: '1.8rem' }}>📦</span>
                    </div>
                    <div className="stat-content">
                        <h3>{stats.productosTotal}</h3>
                        <p>Productos Activos</p>
                    </div>
                </div>

                {!isVendedor && (
                    <div className="stat-card">
                        <div className="stat-icon">
                            <span style={{ fontSize: '1.8rem' }}>⚠️</span>
                        </div>
                        <div className="stat-content">
                            <h3>{stats.productosBajoStock}</h3>
                            <p>Stock Bajo</p>
                        </div>
                    </div>
                )}

                <div className="stat-card">
                    <div className="stat-icon">
                        <span style={{ fontSize: '1.8rem' }}>💰</span>
                    </div>
                    <div className="stat-content">
                        <h3>{stats.sesionCajaAbierta ? 'Abierta' : 'Cerrada'}</h3>
                        <p>Sesión de Caja</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <span style={{ fontSize: '1.8rem' }}>🛒️</span>
                    </div>
                    <div className="stat-content">
                        <h3>{stats.ventasHoy}</h3>
                        <p>Estado Ventas</p>
                    </div>
                </div>

                {!isVendedor && (
                    <div className="stat-card">
                        <div className="stat-icon">
                            <span style={{ fontSize: '1.8rem' }}>💵</span>
                        </div>
                        <div className="stat-content">
                            <h3>${parseFloat(stats.valorStockVenta || 0).toFixed(2)}</h3>
                            <p>Valor Stock (Precio Venta)</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="quick-actions">
                <h2>Acciones Rápidas</h2>
                <div className="actions-grid">
                    <Link to="/pos" className="action-card">
                        <span className="action-icon">🛍️</span>
                        <h3>Punto de Venta</h3>
                        <p>Realizar una venta</p>
                    </Link>

                    <Link to="/caja" className="action-card">
                        <span className="action-icon">💵</span>
                        <h3>Caja</h3>
                        <p>Gestionar caja registradora</p>
                    </Link>

                    <Link to="/productos" className="action-card">
                        <span className="action-icon">📦</span>
                        <h3>Productos</h3>
                        <p>Ver inventario</p>
                    </Link>

                    {!isVendedor && (
                        <>
                            <Link to="/compras" className="action-card">
                                <span className="action-icon">📥</span>
                                <h3>Compras</h3>
                                <p>Registrar compras</p>
                            </Link>

                            <Link to="/reportes" className="action-card">
                                <span className="action-icon">📊</span>
                                <h3>Reportes</h3>
                                <p>Ver estadísticas</p>
                            </Link>

                            <Link to="/precios" className="action-card">
                                <span className="action-icon">💲</span>
                                <h3>Precios</h3>
                                <p>Actualizar precios</p>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
