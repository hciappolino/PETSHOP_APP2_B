import { pool } from './config/db.js';

const REQUIRED_TABLES = {
    usuarios: ['id', 'username', 'password_hash', 'nombre', 'email', 'rol', 'activo', 'created_at'],
    proveedores: ['id', 'nombre', 'cuit', 'contacto', 'telefono', 'email', 'direccion', 'activo', 'created_at'],
    clientes: ['id', 'nombre', 'dni_cuit', 'telefono', 'email', 'direccion', 'saldo_cc', 'activo', 'created_at'],
    productos: ['id', 'nombre', 'codigo', 'tipo_presentacion', 'factor_conversion', 'costo_ultima_compra', 'stock_actual', 'stock_minimo', 'activo', 'created_at'],
    cuentas_pago: ['id', 'nombre', 'tipo', 'saldo_actual', 'es_contabilizada', 'activo', 'created_at'],
    sesiones_caja: ['id', 'estado', 'apertura_fecha', 'cierre_fecha', 'saldo_apertura', 'saldo_cierre_esperado', 'saldo_cierre_real', 'diferencia', 'usuario_apertura_id', 'usuario_cierre_id'],
    compras_facturas: ['id', 'proveedor_id', 'fecha', 'numero_factura', 'total', 'monto_pagado', 'pagado', 'notas', 'created_at'],
    compras_renglones: ['id', 'factura_id', 'producto_id', 'descripcion', 'cantidad', 'precio_costo', 'subtotal'],
    pagos_compra: ['id', 'factura_id', 'cuenta_pago_id', 'monto', 'fecha_pago', 'referencia', 'notas', 'usuario_id', 'created_at'],
    ventas: ['id', 'cliente_id', 'lista_precio_id', 'fecha', 'total', 'cuenta_pago_id', 'sesion_caja_id', 'usuario_id', 'tipo_venta'],
    venta_items: ['id', 'venta_id', 'producto_id', 'cantidad', 'precio_venta', 'es_granel', 'subtotal'],
    stock_movimientos: ['id', 'producto_id', 'tipo', 'cantidad', 'motivo', 'referencia_id', 'stock_anterior', 'stock_nuevo', 'usuario_id', 'notas', 'created_at'],
    fondos_movimientos: ['id', 'cuenta_id', 'tipo', 'monto', 'motivo', 'referencia_id', 'sesion_caja_id', 'saldo_anterior', 'saldo_nuevo', 'usuario_id', 'descripcion', 'created_at'],
    listas_precios: ['id', 'nombre', 'descripcion', 'es_default', 'activo', 'created_at'],
    lista_articulo: ['id', 'lista_precio_id', 'producto_id', 'precio_venta_unidad', 'precio_venta_granel', 'created_at'],
    articulos_proveedor: ['id', 'producto_id', 'proveedor_id', 'codigo_proveedor', 'ultimo_costo', 'created_at']
};

export async function verifyDatabaseStructure() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 VERIFICANDO ESTRUCTURA DE BASE DE DATOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const client = await pool.connect();
    try {
        let allTablesOk = true;
        const missingTables = [];
        const missingColumns = {};

        for (const [tableName, requiredColumns] of Object.entries(REQUIRED_TABLES)) {
            // 1. Check if table exists
            const tableExists = await client.query(
                `SELECT EXISTS(
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )`,
                [tableName]
            );

            if (!tableExists.rows[0].exists) {
                allTablesOk = false;
                missingTables.push(tableName);
                console.log(`❌ TABLA FALTANTE: ${tableName}`);
                continue;
            }

            // 2. Check if all required columns exist
            const columnCheck = await client.query(
                `SELECT column_name FROM information_schema.columns 
                 WHERE table_name = $1`,
                [tableName]
            );

            const existingColumns = columnCheck.rows.map(r => r.column_name);
            const missing = requiredColumns.filter(col => !existingColumns.includes(col));

            if (missing.length > 0) {
                allTablesOk = false;
                missingColumns[tableName] = missing;
                console.log(`⚠️  TABLA "${tableName}" - Columnas faltantes: ${missing.join(', ')}`);
            } else {
                console.log(`✅ ${tableName} - OK (${requiredColumns.length} columnas)`);
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (allTablesOk) {
            console.log('✓ ¡TODAS LAS TABLAS Y COLUMNAS ESTÁN CORRECTAS!\n');
            return true;
        } else {
            console.log('\n⚠️  PROBLEMAS DETECTADOS EN LA BASE DE DATOS:\n');
            
            if (missingTables.length > 0) {
                console.log('Tablas faltantes:');
                missingTables.forEach(t => console.log(`  - ${t}`));
                console.log();
            }

            if (Object.keys(missingColumns).length > 0) {
                console.log('Columnas faltantes:');
                for (const [table, cols] of Object.entries(missingColumns)) {
                    console.log(`  - ${table}: ${cols.join(', ')}`);
                }
                console.log();
            }

            console.log('⚠️  SOLUCIÓN: Ejecuta el script de inicialización:');
            console.log('   Windows: INICIAR_SISTEMA.bat');
            console.log('   Linux/Mac: bash start.sh\n');
            
            return false;
        }

    } catch (error) {
        console.error('❌ Error al verificar estructura:', error.message);
        return false;
    } finally {
        client.release();
    }
}

export async function getTableStats() {
    const client = await pool.connect();
    try {
        console.log('\n📊 ESTADÍSTICAS DE TABLAS:\n');
        
        for (const tableName of Object.keys(REQUIRED_TABLES)) {
            try {
                const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                const count = result.rows[0].count;
                const indicator = count > 0 ? '●' : '○';
                console.log(`  ${indicator} ${tableName.padEnd(20)} : ${count} registros`);
            } catch (e) {
                console.log(`  ✗ ${tableName.padEnd(20)} : [ERROR]`);
            }
        }
        console.log();
    } catch (error) {
        console.error('Error getting table stats:', error);
    } finally {
        client.release();
    }
}

export async function ensureRequiredAccounts() {
    const client = await pool.connect();
    try {
        console.log('\n💰 VERIFICANDO CUENTAS ESPECIALES:\n');

        const requiredAccounts = [
            { nombre: 'PAGOS_EXTRAORDINARIOS', tipo: 'EXTERNA', es_contabilizada: false }
        ];

        for (const account of requiredAccounts) {
            const exists = await client.query(
                'SELECT id FROM cuentas_pago WHERE nombre = $1',
                [account.nombre]
            );

            if (exists.rows.length === 0) {
                await client.query(
                    'INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, es_contabilizada, activo) VALUES ($1, $2, $3, $4, $5)',
                    [account.nombre, account.tipo, 0.00, account.es_contabilizada, true]
                );
                console.log(`  ✓ Creada: ${account.nombre}`);
            } else {
                console.log(`  ✓ Existe: ${account.nombre}`);
            }
        }
        console.log();
    } catch (error) {
        console.error('Error ensuring required accounts:', error);
    } finally {
        client.release();
    }
}
