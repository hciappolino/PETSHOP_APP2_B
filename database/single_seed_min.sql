-- Minimal Seed Data (admin + core config)

-- Admin user with rol_id = 1 (admin role)
INSERT INTO usuarios (username, password_hash, nombre, email, rol_id, activo)
VALUES ('admin', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'Administrador', 'admin@petshop.com', 1, true);

-- 2. Default price list (required for POS)
INSERT INTO listas_precios (nombre, descripcion, es_default, activo)
VALUES ('Minorista', 'Lista de precios estándar', true, true);

-- 3. Payment accounts (base)
INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, es_caja_operativa, es_caja_fondo, visible_pos, es_contabilizada, activo)
VALUES ('Caja Operativa', 'EFECTIVO', 0.00, true, false, true, true, true);

INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, es_caja_operativa, es_caja_fondo, visible_pos, es_contabilizada, activo)
VALUES ('Caja Fondo', 'EFECTIVO', 0.00, false, true, false, true, true);

INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, es_caja_operativa, es_caja_fondo, visible_pos, es_contabilizada, activo)
VALUES ('Banco', 'BANCO', 0.00, false, false, true, true, true);
