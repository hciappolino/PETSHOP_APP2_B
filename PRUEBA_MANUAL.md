# 🐾 Pet Shop - Prueba Manual del Sistema

## Paso 1: Iniciar el Backend

Abre una terminal (PowerShell o CMD) y ejecuta:

```bash
cd E:\PETSHOP_APP2\backend
npm start
```

**Esperado:** Verás algo como:
```
╔═══════════════════════════════════════════════════════╗
║   🐾 Pet Shop Management System - Backend API 🐾    ║
╠═══════════════════════════════════════════════════════╣
║   Server running on: http://localhost:3000           ║
║   Environment: development                      ║
║   Database: petshop_app                       ║
╚═══════════════════════════════════════════════════════╝
```

## Paso 2: Verificar la Base de Datos

En otra terminal, verifica que la BD está lista:

```bash
cd E:\PETSHOP_APP2
node diagnose-system.js
```

Debería mostrar:
- ✓ Backend Health
- ✓ Auth Login Endpoint (con datos del usuario admin)

## Paso 3: Iniciar el Frontend

En otra terminal:

```bash
cd E:\PETSHOP_APP2\frontend
npm run dev
```

**Esperado:** Verás:
```
  ➜  Local:   http://localhost:5173/
```

## Paso 4: Probar Login

### Opción A: Usando la aplicación React (http://localhost:5173)

1. Abre http://localhost:5173 en tu navegador
2. Deberías ver la pantalla de login
3. Ingresa las credenciales:
   - **Usuario:** admin
   - **Contraseña:** admin123
4. Presiona "Ingresar"

### Opción B: Usando el formulario de prueba (http://localhost:5173/test-login.html)

1. Abre http://localhost:5173/test-login.html en tu navegador
2. Los campos ya tienen "admin" y "admin123" pre-cargados
3. Presiona "Ingresar"

## Otros usuarios para probar:

- **Usuario:** vendedor1 / **Contraseña:** admin123
- **Usuario:** gerente / **Contraseña:** admin123

## Solución de Problemas

### "Error: Backend desconectado"
- Asegúrate que el backend esté corriendo en terminal anterior
- Verifica que sea http://localhost:3000 (puerto 3000)

### "Error al iniciar sesión"
- Verifica la contraseña (debe ser exactamente "admin123")
- Revisa la consola del backend para ver qué error retorna

### "CORS Error"
- El backend debe tener CORS habilitado (ya está configurado)
- Verifica que el backend esté en http://localhost:3000

### "Página en blanco"
- Abre Developer Tools (F12) → Console
- Verifica si hay errores de JavaScript
- Revisa la pestaña Network para ver las llamadas a la API

## Logs útiles

**Backend:** Terminal donde ejecutaste `npm start`
**Frontend:** Console del navegador (F12)
**API Calls:** Network tab en Developer Tools

---

**Sistema:** Single-Company Architecture  
**Base de Datos:** petshop_app (PostgreSQL)  
**Backend:** http://localhost:3000  
**Frontend:** http://localhost:5173
