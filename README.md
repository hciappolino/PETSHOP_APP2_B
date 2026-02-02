# Pet Shop Management System

Sistema completo de gestión para tiendas de mascotas con control de inventario, ventas, compras y caja registradora.

## 🚀 Características

- **Sistema Multi-Empresa (Multi-Tenant)**: Cada negocio tiene su propia base de datos aislada
- **Gestión de Inventario**: Control completo de productos con seguimiento de stock
- **Punto de Venta (POS)**: Interfaz moderna para ventas rápidas
- **Productos a Granel**: Soporte para venta por peso (kg) y por unidad
- **Listas de Precios Múltiples**: Minorista, Mayorista, Especial, etc.
- **Caja Registradora**: Control de sesiones de caja con apertura y cierre
- **Trazabilidad Completa**: Registro automático de todos los movimientos de stock y fondos
- **Compras**: Registro de compras a proveedores con actualización automática de costos
- **Clientes y Proveedores**: Gestión de relaciones comerciales
- **Reportes**: Estadísticas de ventas, productos más vendidos, stock bajo
- **Autenticación**: Sistema de login con roles (admin, gerente, vendedor) y selector de empresa
- **Reglas de Negocio**: Validaciones automáticas para garantizar integridad de datos

## 📋 Requisitos Previos

### Para Desarrollo Local

- **Node.js** 18 o superior
- **PostgreSQL** 12 o superior
- **npm** o **yarn**

### Para Deployment con Docker

- **Docker** 20.10 o superior
- **Docker Compose** 2.0 o superior

## 🛠️ Instalación y Configuración

### Opción 1: Desarrollo Local (Windows)

1. **Clonar o descargar el proyecto**

2. **Ejecutar el script de inicio**
   ```cmd
   INICIAR_SISTEMA.bat
   ```

   Este script automáticamente:
   - Verifica PostgreSQL y Node.js
   - Crea la base de datos
   - Ejecuta las migraciones
   - Instala dependencias
   - Inicia backend y frontend

3. **Acceder a la aplicación**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Usuario: `admin`
   - Contraseña: `admin123`

### Opción 2: Desarrollo Local (Linux/Mac)

1. **Dar permisos de ejecución al script**
   ```bash
   chmod +x start.sh
   ```

2. **Ejecutar el script**
   ```bash
   ./start.sh
   ```

### Opción 3: Deployment con Docker

1. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

2. **Iniciar los contenedores**
   ```bash
   docker-compose up -d
   ```

3. **Acceder a la aplicación**
   - Aplicación: http://localhost
   - Usuario: `admin`
   - Contraseña: `admin123`

4. **Ver logs**
   ```bash
   docker-compose logs -f
   ```

5. **Detener los contenedores**
   ```bash
   docker-compose down
   ```

## 📁 Estructura del Proyecto

```
PETSHOP_APP2/
├── backend/                 # API Node.js + Express
│   ├── config/             # Configuración de base de datos
│   ├── middleware/         # Autenticación y autorización
│   ├── routes/             # Rutas de la API
│   ├── server.js           # Punto de entrada del servidor
│   └── package.json
├── frontend/               # Aplicación React
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── context/       # Context API (Auth)
│   │   ├── pages/         # Páginas de la aplicación
│   │   ├── App.jsx        # Componente principal
│   │   └── main.jsx       # Punto de entrada
│   ├── index.html
│   └── package.json
├── database/              # Scripts de base de datos
│   ├── schema.sql         # Esquema de tablas
│   ├── triggers.sql       # Triggers para reglas de negocio
│   └── seed.sql           # Datos iniciales
├── docker-compose.yml     # Configuración Docker
├── INICIAR_SISTEMA.bat    # Script de inicio (Windows)
├── start.sh               # Script de inicio (Linux/Mac)
└── README.md
```

## 🗄️ Base de Datos

### Arquitectura Multi-Tenant

El sistema utiliza una arquitectura multi-tenant con bases de datos separadas:

- **petshop_master**: Base de datos maestra que gestiona empresas y usuarios
  - `empresas`: Registro de todas las empresas/negocios
  - `empresa_usuarios`: Usuarios de cada empresa con sus credenciales

- **petshop_[empresa]**: Una base de datos por cada empresa
  - Datos completamente aislados entre empresas
  - Esquema completo de productos, ventas, clientes, etc.

### Entidades Principales (por empresa)

- **users**: Usuarios del sistema con roles (deprecado, se usa empresa_usuarios en master)
- **proveedores**: Proveedores de productos
- **clientes**: Clientes con cuenta corriente
- **productos**: Catálogo de productos
- **listas_precios**: Listas de precios (Minorista, Mayorista, etc.)
- **lista_articulo**: Precios de productos por lista
- **compras_facturas / compras_renglones**: Compras a proveedores
- **ventas / venta_items**: Ventas realizadas
- **cuentas_pago**: Formas de pago (Efectivo, MP, Banco)
- **sesiones_caja**: Control de apertura/cierre de caja
- **stock_movimientos**: Trazabilidad de inventario
- **fondos_movimientos**: Trazabilidad financiera

### Reglas de Negocio Implementadas

1. **Integridad de Stock**: Todo cambio en stock genera un registro en `stock_movimientos`
2. **Lógica Granel**: 
   - Al abrir una bolsa se descuenta 1 unidad del stock
   - Las ventas a granel no descuentan stock adicional
3. **Integridad de Fondos**: Todo movimiento de dinero se registra en `fondos_movimientos`
4. **Sesión de Caja Obligatoria**: No se pueden realizar ventas sin una sesión abierta
5. **Actualización Automática de Costos**: Al registrar una compra se actualiza el costo del producto
6. **Eliminación Segura**: No se pueden eliminar productos o cuentas con movimientos históricos

## 🔐 Usuarios y Roles

### Empresas Demo

El sistema incluye dos empresas de demostración:

**1. Empresa Demo** (con datos de prueba)
```
Empresa: Empresa Demo
Usuario: admin
Contraseña: admin123
Rol: admin
```

**2. Mi Negocio** (sin datos de prueba)
```
Empresa: Mi Negocio
Usuario: admin
Contraseña: admin123
Rol: admin
```

### Roles Disponibles

- **admin**: Acceso completo al sistema + gestión de empresas
- **gerente**: Acceso a todas las funciones excepto gestión de usuarios
- **vendedor**: Solo acceso a POS y caja

> ⚠️ **IMPORTANTE**: Cambiar estas contraseñas en producción

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/change-password` - Cambiar contraseña

### Productos
- `GET /api/productos` - Listar productos
- `POST /api/productos` - Crear producto
- `PUT /api/productos/:id` - Actualizar producto
- `POST /api/productos/:id/ajustar-stock` - Ajustar stock
- `POST /api/productos/:id/abrir-bolsa` - Abrir bolsa para granel

### Ventas
- `GET /api/ventas` - Listar ventas
- `POST /api/ventas` - Crear venta (POS)
- `GET /api/ventas/:id` - Detalle de venta

### Caja
- `GET /api/sesiones-caja/actual` - Sesión actual
- `POST /api/sesiones-caja/abrir` - Abrir caja
- `POST /api/sesiones-caja/:id/cerrar` - Cerrar caja

### Reportes
- `GET /api/reportes/ventas` - Reporte de ventas
- `GET /api/reportes/productos-vendidos` - Productos más vendidos
- `GET /api/reportes/stock-bajo` - Productos con stock bajo

## 🎨 Tecnologías Utilizadas

### Backend
- Node.js + Express
- PostgreSQL
- JWT para autenticación
- bcrypt para encriptación de contraseñas

### Frontend
- React 18
- React Router para navegación
- Axios para peticiones HTTP
- CSS moderno con variables y glassmorphism

### DevOps
- Docker & Docker Compose
- Nginx como servidor web

## 🚀 Deployment a Servidor

### Opción 1: Docker (Recomendado)

1. Copiar el proyecto al servidor
2. Configurar `.env` con credenciales de producción
3. Ejecutar:
   ```bash
   docker-compose up -d
   ```

### Opción 2: Manual

1. Instalar PostgreSQL y Node.js en el servidor
2. Crear base de datos y ejecutar scripts SQL
3. Configurar variables de entorno
4. Instalar dependencias y compilar frontend:
   ```bash
   cd frontend && npm install && npm run build
   ```
5. Configurar Nginx o Apache para servir el frontend
6. Iniciar backend con PM2:
   ```bash
   npm install -g pm2
   cd backend && pm2 start server.js --name petshop-api
   ```

## 📝 Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petshop_app
DB_USER=postgres
DB_PASSWORD=tu_password

# Backend
PORT=3000
JWT_SECRET=tu_secreto_muy_seguro_cambiar_en_produccion

# Frontend
VITE_API_URL=http://localhost:3000
```

## 🐛 Solución de Problemas

### Error de conexión a la base de datos
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales en `.env`
- Verificar que la base de datos `petshop_app` exista

### Error "Cannot find module"
- Ejecutar `npm install` en backend y frontend

### Puerto ya en uso
- Cambiar el puerto en `.env` (backend) o `vite.config.js` (frontend)

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👥 Soporte

Para reportar problemas o solicitar características, crear un issue en el repositorio del proyecto.

---

**Desarrollado con ❤️ para tiendas de mascotas**
