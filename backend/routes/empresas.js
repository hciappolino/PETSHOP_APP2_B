import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Single-company architecture info
router.get('/', authenticateToken, async (req, res) => {
    res.json({
        note: 'Single-company architecture',
        message: 'Este sistema funciona con una única empresa',
        empresa: {
            nombre: 'PetShop',
            modo: 'single-company'
        }
    });
});

export default router;
