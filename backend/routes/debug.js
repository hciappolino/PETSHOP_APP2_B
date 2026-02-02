import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Get summary of all movements (NO AUTH - for debugging only)
router.get('/summary', async (req, res) => {
    try {
        const stockCount = await pool.query('SELECT COUNT(*) as total FROM stock_movimientos');
        const fundCount = await pool.query('SELECT COUNT(*) as total FROM fondos_movimientos');
        const ventasCount = await pool.query('SELECT COUNT(*) as total FROM ventas');
        const comprasCount = await pool.query('SELECT COUNT(*) as total FROM compras_facturas');

        // Last 5 stock movements
        const lastStock = await pool.query(
            `SELECT sm.*, p.nombre FROM stock_movimientos sm 
             LEFT JOIN productos p ON sm.producto_id = p.id 
             ORDER BY sm.created_at DESC LIMIT 5`
        );

        // Last 5 fund movements
        const lastFunds = await pool.query(
            `SELECT fm.*, cp.nombre FROM fondos_movimientos fm 
             LEFT JOIN cuentas_pago cp ON fm.cuenta_id = cp.id 
             ORDER BY fm.created_at DESC LIMIT 5`
        );

        res.json({
            totals: {
                stock_movimientos: parseInt(stockCount.rows[0].total),
                fondos_movimientos: parseInt(fundCount.rows[0].total),
                ventas: parseInt(ventasCount.rows[0].total),
                compras: parseInt(comprasCount.rows[0].total)
            },
            lastMovements: {
                stock: lastStock.rows,
                fondos: lastFunds.rows
            }
        });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
