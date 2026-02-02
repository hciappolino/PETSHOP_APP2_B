// Script para corregir movimientos con montos negativos en fondos_movimientos
// Convierte los montos negativos a positivos manteniendo el tipo de movimiento

import { pool } from '../backend/config/db.js';

async function fixNegativeAmounts() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Buscando movimientos con montos negativos...');
        
        // Buscar movimientos con monto negativo
        const result = await client.query(
            `SELECT id, cuenta_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion, created_at
             FROM fondos_movimientos 
             WHERE monto < 0
             ORDER BY created_at DESC`
        );
        
        if (result.rows.length === 0) {
            console.log('✅ No se encontraron movimientos con montos negativos.');
            return;
        }
        
        console.log(`⚠️  Se encontraron ${result.rows.length} movimientos con montos negativos.`);
        console.log('\n📋 Movimientos a corregir:');
        
        result.rows.forEach(mov => {
            console.log(`   ID: ${mov.id} | Cuenta: ${mov.cuenta_id} | Tipo: ${mov.tipo} | Monto: ${mov.monto} | Fecha: ${mov.created_at}`);
        });
        
        console.log('\n🔧 Corrigiendo montos...');
        
        // Actualizar todos los montos negativos a positivos
        const updateResult = await client.query(
            `UPDATE fondos_movimientos 
             SET monto = ABS(monto)
             WHERE monto < 0
             RETURNING id, cuenta_id, tipo, monto`
        );
        
        console.log(`✅ Se corrigieron ${updateResult.rows.length} movimientos.`);
        
        // Verificar si hay inconsistencias en los saldos
        console.log('\n🔍 Verificando consistencia de saldos...');
        
        const cuentasResult = await client.query(
            `SELECT c.id, c.nombre, c.saldo_actual,
                    COALESCE(SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END), 0) as saldo_calculado
             FROM cuentas_pago c
             LEFT JOIN fondos_movimientos fm ON c.id = fm.cuenta_id
             GROUP BY c.id, c.nombre, c.saldo_actual
             HAVING c.saldo_actual != COALESCE(SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END), 0)`
        );
        
        if (cuentasResult.rows.length > 0) {
            console.log('\n⚠️  Cuentas con saldos inconsistentes:');
            cuentasResult.rows.forEach(c => {
                console.log(`   ${c.nombre}: Saldo actual: ${c.saldo_actual}, Saldo calculado: ${c.saldo_calculado}`);
            });
            console.log('\n💡 Sugerencia: Recalcular los saldos de estas cuentas basándose en los movimientos.');
        } else {
            console.log('✅ Todos los saldos son consistentes.');
        }
        
        console.log('\n🎉 Proceso completado exitosamente.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar el script
fixNegativeAmounts().catch(console.error);
