// Script para corregir movimientos de balanceo anteriores
// Invierte el tipo (INGRESO/EGRESO) de los movimientos de balanceo que están incorrectos

import { pool } from '../backend/config/db.js';

async function fixBalanceoMovimientos() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Buscando movimientos de balanceo (AJUSTE) con posibles errores...');
        
        // Buscar movimientos de balanceo
        const result = await client.query(
            `SELECT id, cuenta_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion, created_at
             FROM fondos_movimientos 
             WHERE motivo = 'AJUSTE'
               AND descripcion LIKE 'Balanceo%'
             ORDER BY created_at DESC`
        );
        
        if (result.rows.length === 0) {
            console.log('✅ No se encontraron movimientos de balanceo.');
            return;
        }
        
        console.log(`📋 Se encontraron ${result.rows.length} movimientos de balanceo.`);
        console.log('\nAnalizando cada movimiento...\n');
        
        let corregidos = 0;
        
        for (const mov of result.rows) {
            // Determinar si el movimiento es lógicamente correcto
            // Si es "Balanceo a cuenta:" y el saldo_anterior era negativo, debería ser INGRESO
            // Si es "Balanceo desde cuenta:" y el saldo_anterior era positivo, debería ser EGRESO
            
            const esBalanceoA = mov.descripcion.includes('Balanceo a cuenta:');
            const esBalanceoDesde = mov.descripcion.includes('Balanceo desde cuenta:');
            const saldoAnterior = parseFloat(mov.saldo_anterior);
            const saldoNuevo = parseFloat(mov.saldo_nuevo);
            
            let tipoCorrecto = null;
            
            if (esBalanceoA) {
                // Es la cuenta origen (la que se balancea)
                // Si tenía saldo negativo (deuda) → debería ser INGRESO (se reduce deuda)
                // Si tenía saldo positivo → debería ser EGRESO (se entrega dinero)
                if (saldoAnterior < 0 && mov.tipo !== 'INGRESO') {
                    tipoCorrecto = 'INGRESO';
                } else if (saldoAnterior > 0 && mov.tipo !== 'EGRESO') {
                    tipoCorrecto = 'EGRESO';
                }
            } else if (esBalanceoDesde) {
                // Es la cuenta destino (la que recibe)
                // Si la cuenta origen tenía saldo negativo (deuda) → destino debería ser EGRESO (paga la deuda)
                // Si la cuenta origen tenía saldo positivo → destino debería ser INGRESO (recibe dinero)
                // El saldo_anterior de la cuenta destino no nos dice directamente, pero podemos inferir
                // Si el saldo_nuevo < saldo_anterior, es EGRESO
                // Si el saldo_nuevo > saldo_anterior, es INGRESO
                if (saldoNuevo < saldoAnterior && mov.tipo !== 'EGRESO') {
                    tipoCorrecto = 'EGRESO';
                } else if (saldoNuevo > saldoAnterior && mov.tipo !== 'INGRESO') {
                    tipoCorrecto = 'INGRESO';
                }
            }
            
            if (tipoCorrecto && tipoCorrecto !== mov.tipo) {
                console.log(`🔄 Corrigiendo movimiento ID ${mov.id}:`);
                console.log(`   Cuenta: ${mov.cuenta_id}`);
                console.log(`   Descripción: ${mov.descripcion}`);
                console.log(`   Saldo Anterior: ${mov.saldo_anterior} → Saldo Nuevo: ${mov.saldo_nuevo}`);
                console.log(`   Cambio: ${mov.tipo} → ${tipoCorrecto}`);
                
                await client.query(
                    `UPDATE fondos_movimientos 
                     SET tipo = $1
                     WHERE id = $2`,
                    [tipoCorrecto, mov.id]
                );
                
                corregidos++;
            }
        }
        
        console.log(`\n✅ Se corrigieron ${corregidos} movimientos.`);
        
        // Ahora verificar y corregir los saldos de las cuentas
        console.log('\n🔍 Verificando saldos de cuentas...');
        
        const cuentasResult = await client.query(
            `SELECT c.id, c.nombre, c.saldo_actual,
                    COALESCE(SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END), 0) as saldo_calculado
             FROM cuentas_pago c
             LEFT JOIN fondos_movimientos fm ON c.id = fm.cuenta_id
             GROUP BY c.id, c.nombre, c.saldo_actual
             HAVING ABS(c.saldo_actual - COALESCE(SUM(CASE WHEN fm.tipo = 'INGRESO' THEN fm.monto ELSE -fm.monto END), 0)) > 0.01`
        );
        
        if (cuentasResult.rows.length > 0) {
            console.log('\n⚠️  Cuentas con saldos inconsistentes:');
            for (const c of cuentasResult.rows) {
                console.log(`   ${c.nombre}:`);
                console.log(`     Saldo actual: $${parseFloat(c.saldo_actual).toFixed(2)}`);
                console.log(`     Saldo calculado: $${parseFloat(c.saldo_calculado).toFixed(2)}`);
                
                // Corregir el saldo
                await client.query(
                    'UPDATE cuentas_pago SET saldo_actual = $1 WHERE id = $2',
                    [c.saldo_calculado, c.id]
                );
                console.log(`     ✅ Saldo corregido a: $${parseFloat(c.saldo_calculado).toFixed(2)}`);
            }
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
fixBalanceoMovimientos().catch(console.error);
