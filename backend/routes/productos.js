import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import XLSX from 'xlsx';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// SIMPLIFIED FOR SINGLE COMPANY - No multitenancy

// Get all products
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { activo, tipo_presentacion, search, bajo_stock, stock_negativo, lista_id } = req.query;

        // Get default lista_id if not specified
        let listaId = lista_id;
        if (!listaId) {
            const defaultList = await pool.query(
                'SELECT id FROM listas_precios WHERE es_default = true LIMIT 1'
            );
            if (defaultList.rows.length > 0) {
                listaId = defaultList.rows[0].id;
            }
        }

        let query = `
            SELECT p.*,
                   COALESCE(la.precio_venta_unidad, 0) as precio_venta_unidad,
                   COALESCE(la.precio_venta_granel, 0) as precio_venta_granel
            FROM productos p
            LEFT JOIN lista_articulo la ON p.id = la.producto_id AND la.lista_precio_id = $1
            WHERE 1=1
        `;
        const params = [listaId];
        let paramCount = 2;

        if (activo !== undefined) {
            query += ` AND p.activo = $${paramCount}`;
            params.push(activo === 'true');
            paramCount++;
        }

        if (tipo_presentacion) {
            query += ` AND p.tipo_presentacion = $${paramCount}`;
            params.push(tipo_presentacion);
            paramCount++;
        }

        if (search) {
            query += ` AND (p.nombre ILIKE $${paramCount} OR p.codigo ILIKE $${paramCount} OR p.marca ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (bajo_stock === 'true') {
            query += ' AND p.stock_actual <= p.stock_minimo';
        }

        if (stock_negativo === 'true') {
            query += ' AND p.stock_actual < 0';
        }

        query += ' ORDER BY p.nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// Get product by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM productos WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

// Create product
router.post('/', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const {
            nombre, codigo, tipo_presentacion, factor_conversion, stock_minimo,
            fabricante, marca, tipo_animal
        } = req.body;

        if (!nombre || !tipo_presentacion) {
            return res.status(400).json({ error: 'Nombre y tipo de presentación son requeridos' });
        }

        if (!['BOLSA', 'UNIDAD'].includes(tipo_presentacion)) {
            return res.status(400).json({ error: 'Tipo de presentación inválido' });
        }

        const result = await pool.query(
            `INSERT INTO productos 
             (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, stock_minimo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [ nombre, codigo, fabricante || null, marca || null, tipo_presentacion,
                tipo_animal || 'OTROS', factor_conversion || (tipo_presentacion === 'UNIDAD' ? 1 : 25),
                stock_minimo || 0
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El código de producto ya existe para esta empresa' });
        }
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

// Update product
router.put('/:id', authenticateToken, authorizeRole('admin', 'gerente'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre, codigo, tipo_presentacion, factor_conversion, stock_minimo, activo,
            fabricante, marca, tipo_animal
        } = req.body;

        const result = await pool.query(
            `UPDATE productos 
             SET nombre = COALESCE($1, nombre),
                 codigo = COALESCE($2, codigo),
                 fabricante = COALESCE($3, fabricante),
                 marca = COALESCE($4, marca),
                 tipo_presentacion = COALESCE($5, tipo_presentacion),
                 tipo_animal = COALESCE($6, tipo_animal),
                 factor_conversion = COALESCE($7, factor_conversion),
                 stock_minimo = COALESCE($8, stock_minimo),
                 activo = COALESCE($9, activo)
             WHERE id = $10
             RETURNING *`,
            [nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, stock_minimo, activo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

// Adjust stock
router.post('/:id/ajustar-stock', authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { cantidad, motivo, notas } = req.body;

        if (cantidad === undefined || cantidad === null) {
            return res.status(400).json({ error: 'La cantidad es requerida' });
        }

        await client.query('BEGIN');

        const productResult = await client.query(
            'SELECT * FROM productos WHERE id = $1',
            [id]
        );

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const product = productResult.rows[0];
        const stockAnterior = parseFloat(product.stock_actual);
        const cantidadAjuste = parseFloat(cantidad);
        const stockNuevo = stockAnterior + cantidadAjuste;

        // Permitimos stock negativo para ajustes manuales

        await client.query(
            'UPDATE productos SET stock_actual = $1 WHERE id = $2',
            [stockNuevo, id]
        );

        await client.query(
            `INSERT INTO stock_movimientos 
             (producto_id, tipo, cantidad, motivo, stock_anterior, stock_nuevo, usuario_id, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                id,
                cantidadAjuste > 0 ? 'ENTRADA' : 'SALIDA',
                Math.abs(cantidadAjuste),
                motivo || 'AJUSTE',
                stockAnterior,
                stockNuevo,
                req.user.id,
                notas
            ]
        );

        await client.query('COMMIT');

        const updatedResult = await client.query(
            'SELECT * FROM productos WHERE id = $1',
            [id]
        );

        res.json({
            message: 'Stock ajustado exitosamente',
            producto: updatedResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Adjust stock error:', error.message, error.stack);
        res.status(500).json({ error: 'Error al ajustar stock: ' + error.message });
    } finally {
        client.release();
    }
});

// Open bag
router.post('/:id/abrir-bolsa', authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { notas } = req.body;

        await client.query('BEGIN');

        const productResult = await client.query(
            'SELECT * FROM productos WHERE id = $1',
            [id]
        );

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const product = productResult.rows[0];

        if (product.tipo_presentacion !== 'BOLSA') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Solo se pueden abrir productos tipo BOLSA' });
        }

        if (product.stock_actual < 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay stock suficiente para abrir una bolsa' });
        }

        const stockAnterior = parseFloat(product.stock_actual);
        const stockNuevo = stockAnterior - 1;

        await client.query(
            'UPDATE productos SET stock_actual = $1 WHERE id = $2',
            [stockNuevo, id]
        );

        await client.query(
            `INSERT INTO stock_movimientos 
             (producto_id, tipo, cantidad, motivo, stock_anterior, stock_nuevo, usuario_id, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [ id, 'SALIDA', 1, 'APERTURA_BOLSA', stockAnterior, stockNuevo, req.user.id, notas || 'Apertura de bolsa para venta a granel']
        );

        await client.query('COMMIT');

        res.json({
            message: 'Bolsa abierta exitosamente',
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Open bag error:', error);
        res.status(500).json({ error: 'Error al abrir bolsa' });
    } finally {
        client.release();
    }
});

// Delete product
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM productos WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({
                error: 'No se puede eliminar el producto porque tiene registros asociados'
            });
        }
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});



// Endpoint de importación
router.post('/importar-excel', authenticateToken, authorizeRole('admin', 'gerente'), upload.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const client = await pool.connect();
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // Read rows as objects keyed by header; we'll normalize keys to tolerate spaces/case
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });
        const data = rawData.map((row, idx) => {
            const mapped = { __row: idx + 2 }; // track Excel row (header is row 1)
            Object.keys(row).forEach(k => {
                const nk = String(k).toLowerCase().replace(/\s+/g, ''); // e.g. 'nombre producto' -> 'nombreproducto'
                mapped[nk] = row[k];
            });
            return mapped;
        });

        await client.query('BEGIN');
        let creados = 0;
        let actualizados = 0;

        const errors = [];
        for (const fila of data) {
            // fila keys are normalized (no spaces, lowercase)
            const rowNumber = fila.__row || null;
            const codigo = fila['codigo'] || fila['cod'] || null;
            const fabricante = fila['fabricante'] || null;
            const marca = fila['marca'] || null;
            const nombre = fila['nombre'] || fila['nombreproducto'] || fila['nombre_producto'] || fila['producto'] || null;
            const tipo_animal = (fila['animal'] || fila['tipoanimal'] || fila['tipo_animal']) ? (['PERRO', 'GATO'].includes(String(fila['animal'] || fila['tipoanimal'] || fila['tipo_animal']).toUpperCase()) ? String(fila['animal'] || fila['tipoanimal'] || fila['tipo_animal']).toUpperCase() : 'OTROS') : 'OTROS';
            const tipo_presentacion = (fila['tipopresentacion'] || fila['tipo_presentacion'] || 'UNIDAD')?.toString().toUpperCase();
            const factor_conversion = fila['factorconversion'] != null ? fila['factorconversion'] : fila['factor_conversion'];
            const stock_minimo = fila['stockminimo'] != null ? fila['stockminimo'] : fila['stock_minimo'];
            const precio_compra = fila['preciocompra'] != null ? fila['preciocompra'] : fila['precio_compra'];
            const precio_venta_unidad = fila['precioventaunidad'] != null ? fila['precioventaunidad'] : fila['precio_venta_unidad'];
            const precio_venta_granel = fila['precioventagranel'] != null ? fila['precioventagranel'] : fila['precio_venta_granel'];

            // Basic validation
            const rowErrors = [];
            if (!codigo) rowErrors.push('codigo requerido');
            if (!nombre) rowErrors.push('nombre producto requerido');
            if (tipo_presentacion && !['BOLSA', 'UNIDAD'].includes(String(tipo_presentacion).toUpperCase())) rowErrors.push('tipo_presentacion invalido (BOLSA/UNIDAD)');
            // tipo_animal now defaults to OTROS, so no validation error needed
            if (factor_conversion != null && isNaN(parseFloat(factor_conversion))) rowErrors.push('factor_conversion debe ser numerico');
            if (stock_minimo != null && isNaN(parseFloat(stock_minimo))) rowErrors.push('stock_minimo debe ser numerico');
            if (precio_compra != null && precio_compra !== '' && isNaN(parseFloat(precio_compra))) rowErrors.push('precio_compra debe ser numerico');
            if (precio_venta_unidad != null && precio_venta_unidad !== '' && isNaN(parseFloat(precio_venta_unidad))) rowErrors.push('precio_venta_unidad debe ser numerico');
            if (precio_venta_granel != null && precio_venta_granel !== '' && isNaN(parseFloat(precio_venta_granel))) rowErrors.push('precio_venta_granel debe ser numerico');

            if (rowErrors.length > 0) {
                errors.push({ row: rowNumber, codigo: codigo || null, errors: rowErrors });
                continue; // skip this row
            }

            // 1. Upsert del Producto
            const resProd = await client.query(
                `INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, stock_minimo, costo_ultima_compra)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (codigo) DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    fabricante = COALESCE(EXCLUDED.fabricante, productos.fabricante),
                    marca = COALESCE(EXCLUDED.marca, productos.marca),
                    tipo_presentacion = EXCLUDED.tipo_presentacion,
                    tipo_animal = COALESCE(EXCLUDED.tipo_animal, productos.tipo_animal),
                    factor_conversion = EXCLUDED.factor_conversion,
                    stock_minimo = EXCLUDED.stock_minimo,
                    costo_ultima_compra = COALESCE(EXCLUDED.costo_ultima_compra, productos.costo_ultima_compra),
                    activo = true
                 RETURNING id, (xmax = 0) AS es_nuevo`,
                [nombre, codigo.toString(), fabricante || null, marca || null, tipo_presentacion || 'UNIDAD', tipo_animal || 'OTROS', factor_conversion || 1, stock_minimo || 0, precio_compra || 0]
            );

            const { id, es_nuevo } = resProd.rows[0];
            if (es_nuevo) creados++; else actualizados++;

            // 2. Si trae precios de venta, los vinculamos a la lista default (unidad y/o granel)
            if (precio_venta_unidad || precio_venta_granel) {
                await client.query(
                    `INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
                     SELECT id, $1, $2, $3 FROM listas_precios WHERE es_default = true LIMIT 1
                     ON CONFLICT (lista_precio_id, producto_id) DO UPDATE SET
                        precio_venta_unidad = COALESCE(EXCLUDED.precio_venta_unidad, lista_articulo.precio_venta_unidad),
                        precio_venta_granel = COALESCE(EXCLUDED.precio_venta_granel, lista_articulo.precio_venta_granel)`,
                    [id, precio_venta_unidad || null, precio_venta_granel || null]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ 
            message: 'Proceso terminado', 
            creados, 
            actualizados, 
            errors: errors 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Excel import error:', error);
        res.status(500).json({ 
            error: 'Error procesando Excel',
            details: error.message
        });
    } finally {
        client.release();
    }
});

export default router;
