# Deploy en Railway - Guía Paso a Paso

## Requisitos Previo
1. Cuenta en [Railway](https://railway.app/)
2. Proyecto en GitHub/GitLab
3. Node.js y npm instalados en local

---

## Paso 1: Preparar el Proyecto
Asegúrate de tener los cambios hechos:
- `railway.toml` corregido
- Backend configurado para servir frontend
- DB config soportando DATABASE_URL
- Frontend con URL relativa

---

## Paso 2: Crear un Proyecto en Railway
1. Inicia sesión en Railway
2. Haz clic en "New Project"
3. Selecciona "Deploy from GitHub repo" o "Deploy from Dockerfile"
4. Conecta tu GitHub y selecciona el repositorio del petshop

---

## Paso 3: Configurar la Base de Datos PostgreSQL
1. En tu proyecto Railway, haz clic en "Add" > "Database" > "PostgreSQL"
2. Espera a que se cree la base de datos
3. Ve a la pestaña "Connect" y copia la URL de conexión (DATABASE_URL)

---

## Paso 4: Variables de Entorno
1. En tu proyecto Railway, ve a "Variables"
2. Agrega las siguientes variables:

```env
NODE_ENV=production

# Security - Genera una clave segura
JWT_SECRET=TU_CLAVE_JWT_SEGURA_MINIMO_32_CARACTERES

# CORS - Deja como * para desarrollo, o configura tu dominio
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Generar JWT_SECRET
Usa este comando en terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Paso 5: Deployar la Aplicación
1. Railway detectará automáticamente la configuración
2. El proceso de build se iniciará automáticamente
3. Espera a que termine el deploy

---

## Paso 6: Verificar la Aplicación
1. Ve a la pestaña "Deployments" para ver el estado
2. Haz clic en la URL de la aplicación para probarla
3. Verifica el endpoint de health check: `https://tu-dominio.railway.app/health`

---

## Paso 7: Inicializar la Base de Datos
1. En Railway, ve a la pestaña "Data" del PostgreSQL
2. Abre el "Query Runner"
3. Copia y pega el contenido de `database/single_schema.sql` y ejecútalo
4. Copia y pega el contenido de `database/single_seed.sql` y ejecútalo

---

## Paso 8: Configurar Dominio Personalizado (Opcional)
1. En Railway, ve a "Settings" > "Domains"
2. Agrega tu dominio personalizado
3. Configura los registros DNS en tu proveedor

---

## Troubleshooting

### Problemas Comunes:

#### 1. Error de Conexión a DB
- Verifica que DATABASE_URL esté correctamente configurada
- Asegúrate de que la DB PostgreSQL esté en funcionamiento

#### 2. Frontend no se Muestra
- Verifica que el build del frontend se haya realizado
- Revisa los logs del deployment para errores

#### 3. CORS Errors
- Asegúrate de que CORS_ORIGIN esté configurado correctamente
- Para desarrollo, usa `CORS_ORIGIN=*`

#### 4. Health Check Fallido
- Verifica el endpoint `/health`
- Revisa los logs del backend

---

## Monitoreo
- En Railway, la pestaña "Logs" muestra los registros en tiempo real
- La pestaña "Metrics" muestra información sobre recursos
- Configura alertas en "Alerts"

---

## Actualizaciones
1. Realiza cambios en tu repositorio
2. Git push a la rama configurada (main/master)
3. Railway deployará automáticamente la versión nueva

---

## Backups
Railway hace backups automáticos de la base de datos. Puedes restaurar desde la pestaña "Backups".
