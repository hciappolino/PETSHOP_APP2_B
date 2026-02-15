import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizePermission } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get backup directory from env or use default
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET /api/backups - List all backups
router.get('/', authenticateToken, authorizePermission('admin.backups'), async (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.dump'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    filename: f,
                    size: stats.size,
                    sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                    created: stats.birthtime,
                    createdFormatted: new Date(stats.birthtime).toLocaleString('es-AR')
                };
            })
            .sort((a, b) => b.created - a.created);
        
        res.json(files);
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ error: 'Error al listar backups' });
    }
});

// POST /api/backups/crear - Create a new backup
router.post('/crear', authenticateToken, authorizePermission('admin.backups'), async (req, res) => {
    try {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `petshop_backup_${timestamp}.dump`;
        const filepath = path.join(BACKUP_DIR, filename);
        
        // Get database connection info from pool
        const dbConfig = pool;
        
        // Build pg_dump command
        const pgDumpCmd = `pg_dump -Fc -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} -d ${process.env.DB_NAME || 'petshop_app'} -f "${filepath}"`;
        
        // Execute pg_dump
        await execAsync(pgDumpCmd);
        
        const stats = fs.statSync(filepath);
        
        res.json({
            success: true,
            message: 'Backup creado correctamente',
            filename,
            size: stats.size,
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
            downloadUrl: `/api/backups/descargar/${filename}`
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: 'Error al crear backup: ' + error.message });
    }
});

// GET /api/backups/descargar/:filename - Download a backup file
router.get('/descargar/:filename', authenticateToken, authorizePermission('admin.backups'), async (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(BACKUP_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Archivo de backup no encontrado' });
        }
        
        res.download(filepath, filename);
    } catch (error) {
        console.error('Error downloading backup:', error);
        res.status(500).json({ error: 'Error al descargar backup' });
    }
});

// POST /api/backups/restaurar - Restore from a backup file
router.post('/restaurar', authenticateToken, authorizePermission('admin.backups'), async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({ error: 'Nombre de archivo requerido' });
        }
        
        const filepath = path.join(BACKUP_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Archivo de backup no encontrado' });
        }
        
        // Build pg_restore command
        const pgRestoreCmd = `pg_restore -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} -d ${process.env.DB_NAME || 'petshop_app'} -c "${filepath}"`;
        
        // Execute pg_restore
        await execAsync(pgRestoreCmd);
        
        res.json({
            success: true,
            message: 'Base de datos restaurada correctamente'
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({ error: 'Error al restaurar backup: ' + error.message });
    }
});

// DELETE /api/backups/:filename - Delete a backup file
router.delete('/:filename', authenticateToken, authorizePermission('admin.backups'), async (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(BACKUP_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Archivo de backup no encontrado' });
        }
        
        fs.unlinkSync(filepath);
        
        res.json({ success: true, message: 'Backup eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({ error: 'Error al eliminar backup' });
    }
});

export default router;
