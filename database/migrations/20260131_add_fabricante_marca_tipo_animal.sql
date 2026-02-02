-- Migration: Add fabricante, marca, tipo_animal to productos
-- Run with: psql -U <user> -d <db> -f 20260131_add_fabricante_marca_tipo_animal.sql

BEGIN;

-- Add columns if they do not exist
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS fabricante VARCHAR(100);

ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS marca VARCHAR(100);

-- Add tipo_animal with check constraint; create type via CHECK
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS tipo_animal VARCHAR(20) DEFAULT 'OTROS';

-- Create/ensure check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage ccu
        JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'productos' AND tc.constraint_type = 'CHECK' AND ccu.column_name = 'tipo_animal'
    ) THEN
        ALTER TABLE productos
            ADD CONSTRAINT chk_productos_tipo_animal CHECK (tipo_animal IN ('GATO','PERRO','OTROS'));
    END IF;
END$$;

-- Backfill existing rows with default
UPDATE productos SET tipo_animal = 'OTROS' WHERE tipo_animal IS NULL OR tipo_animal = '';

COMMIT;
