# PetShop App - Arquitectura Simplificada (Single Company)

## ⚠️ CAMBIOS IMPORTANTES

Esta versión del sistema ha sido **refactorizada de multiempresa a single-company**:

### Lo que cambió:

1. **Base de Datos**: Una única BD (`petshop_app`) para una única empresa
   - ✅ Eliminadas tablas `empresas` y `usuario_empresas`
   - ✅ Removido `empresa_id` de todas las tablas
   - ✅ Usuarios tienen rol directo (admin, vendedor, gerente)

2. **Autenticación**: Login simplificado
   - ✅ Sin selección de empresa en login
   - ✅ Sin `empresa_id` en JWT tokens
   - ✅ Solo usuario/contraseña requeridos

3. **Backend**: Todas las rutas simplificadas
   - ✅ Removido `req.empresaId` de middlewares
   - ✅ Removido filtering por `empresa_id` en queries
   - ✅ Removido `empresa_id` de parámetros de API

4. **Frontend**: Esperará actualización (próximo paso)

## 🚀 Cómo Levantar el Sistema

### 1. Configurar variables de entorno

```bash
# .env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petshop_app
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=tu_secret_muy_seguro
```

### 2. Crear base de datos

```bash
psql -U postgres -c "CREATE DATABASE petshop_app;"
```

### 3. Crear esquema

```bash
psql -U postgres -d petshop_app -f database/single_schema.sql
```

### 4. Insertar datos iniciales

```bash
psql -U postgres -d petshop_app -f database/single_seed.sql
```

### 5. Instalar y ejecutar backend

```bash
cd backend
npm install
npm start
```

Backend estará en: `http://localhost:5000`

## 📝 Credenciales por Defecto

Todos los usuarios tienen password: `admin123` (hash predefinido)

- **admin** - Rol: admin
- **vendedor1** - Rol: vendedor
- **gerente** - Rol: gerente

### Cambiar Contraseñas

```bash
cd backend
node gen_hash.js  # Generate new bcrypt hash
# UPDATE usuarios SET password_hash = '$2b$10...' WHERE username = 'admin';
```

## 🔧 Estructura Simplificada

```
database/
  ├── single_schema.sql   # Esquema sin empresa_id
  └── single_seed.sql     # Datos iniciales (1 empresa demo)

backend/
  ├── config/db.js        # Pool único
  ├── middleware/auth.js  # Auth sin empresa_id
  └── routes/
      ├── auth.js         # Login simple
      ├── productos.js    # Sin filtro empresa
      ├── ventas.js       # Sin filtro empresa
      ├── compras.js      # Sin filtro empresa
      └── [otros]         # Todos simplificados
```

## ✅ Tablas Principales (sin empresa_id)

- `usuarios` - Users with roles (admin, vendedor, gerente)
- `productos` - Products
- `clientes` - Customers
- `proveedores` - Suppliers
- `ventas` - Sales
- `venta_items` - Sale items
- `compras_facturas` - Purchase invoices
- `compras_renglones` - Purchase items
- `sesiones_caja` - Cash sessions
- `cuentas_pago` - Payment accounts
- `stock_movimientos` - Stock movements
- `fondos_movimientos` - Fund movements
- `listas_precios` - Price lists
- `lista_articulo` - Price list items

## 📋 API Endpoints (Ejemplos)

### Login
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

### Productos
```bash
GET /api/productos                    # Get all products
GET /api/productos/:id                # Get product
POST /api/productos                   # Create (admin/gerente)
PUT /api/productos/:id                # Update (admin/gerente)
DELETE /api/productos/:id             # Delete (admin)
POST /api/productos/:id/ajustar-stock # Adjust stock
```

### Ventas
```bash
GET /api/ventas                       # Get all sales
GET /api/ventas/:id                   # Get sale detail
POST /api/ventas                      # Create sale (POS)
```

## 🐛 Próximos Pasos (Si necesario)

1. Actualizar frontend para:
   - Remover selector de empresa en login
   - Remover `empresa_id` de storage
   - Simplificar requests API

2. Testing completo del flujo POS

3. Validar triggers y constraints

## 📞 Soporte

- Database: PostgreSQL 12+
- Node.js: 14+
- npm packages: bcrypt, express, pg, jsonwebtoken, dotenv
