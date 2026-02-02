-- Initial Seed Data for Single Database, Single Company

-- 1. Create admin user (password: admin123)
-- Hash: $2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu
INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo) 
VALUES ('admin', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'Administrador', 'admin@petshop.com', 'admin', true);

-- 2. Create sample users
INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo) 
VALUES ('vendedor1', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'Juan Vendedor', 'juan@petshop.com', 'vendedor', true);

INSERT INTO usuarios (username, password_hash, nombre, email, rol, activo) 
VALUES ('gerente', '$2b$10$Q4egc6JxAAehpcqAmqiPFOCDdk44QTYQwC6neXWrzAIfeR2f51Gbu', 'María Gerente', 'maria@petshop.com', 'gerente', true);

-- 3. Initial price lists
INSERT INTO listas_precios (nombre, descripcion, es_default, activo) 
VALUES ('Minorista', 'Lista de precios estándar', true, true);

-- 4. Payment accounts
INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, activo) 
VALUES ('Efectivo', 'EFECTIVO', 0.00, true);

INSERT INTO cuentas_pago (nombre, tipo, saldo_actual, activo) 
VALUES ('Banco', 'BANCO', 0.00, true);

-- 5. Sample providers
INSERT INTO proveedores (nombre, cuit, contacto, telefono, email, direccion, activo)
VALUES ('Proveedor A', '20123456789', 'Juan', '5551234567', 'proveedor@a.com', 'Calle 1, 123', true);

-- 6. Sample clients
INSERT INTO clientes (nombre, dni_cuit, telefono, email, direccion, saldo_cc, activo)
VALUES ('Cliente Demo', '25987654321', '5559876543', 'cliente@demo.com', 'Avenida 10, 456', 0.00, true);

-- 7. Sample products
INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, costo_ultima_compra, stock_actual, stock_minimo, activo)
VALUES ('Alimento Perro Adulto 15kg', 'PERRO-ADL-15', 'Purina', 'Catchow', 'BOLSA', 'PERRO', 1.000, 2500.00, 10, 2, true);

INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, costo_ultima_compra, stock_actual, stock_minimo, activo)
VALUES ('Alimento Gato Adulto 7kg', 'GATO-ADL-7', 'Purina', 'Gatomax', 'BOLSA', 'GATO', 1.000, 1800.00, 15, 3, true);

INSERT INTO productos (nombre, codigo, fabricante, marca, tipo_presentacion, tipo_animal, factor_conversion, costo_ultima_compra, stock_actual, stock_minimo, activo)
VALUES ('Juguete Pelota de Goma', 'JUG-PELOTA', 'Generic', 'FunPets', 'UNIDAD', 'OTROS', 1.000, 250.00, 50, 10, true);

-- 8. Add products to price list
INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
VALUES (1, 1, 4500.00, 3500.00);

INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
VALUES (1, 2, 3200.00, 2800.00);

INSERT INTO lista_articulo (lista_precio_id, producto_id, precio_venta_unidad, precio_venta_granel)
VALUES (1, 3, 500.00, 400.00);
