-- Update fondos_movimientos.motivo constraint to include caja-specific reasons

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'fondos_movimientos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%motivo%IN%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE fondos_movimientos DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fondos_movimientos_motivo_check'
          AND conrelid = 'fondos_movimientos'::regclass
    ) THEN
        ALTER TABLE fondos_movimientos
            ADD CONSTRAINT fondos_movimientos_motivo_check
            CHECK (motivo IN ('VENTA','COMPRA','GASTO','DEPOSITO','RETIRO','AJUSTE','APERTURA_CAJA','CIERRE_CAJA','AJUSTE_CAJA'));
    END IF;
END $$;
