# Guía de Deploy - Pet Shop App

## Requisitos Previos

- Docker y Docker Compose instalados
- Servidor con al menos 2GB RAM
- Dominio configurado (opcional pero recomendado)
- SSL/TLS certificado (Let's Encrypt recomendado)

## Configuración de Variables de Entorno

### 1. Crear archivo `.env` en la raíz del proyecto

```bash
cp .env.example .env
```

### 2. Configurar variables importantes

```env
# Database configuration
DB_HOST=db
DB_PORT=5432
DB_NAME=petshop_prod
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD_SEGURO_AQUI

# Server configuration
PORT=3000
NODE_ENV=production

# Security - GENERAR CLAVE SEGURA
JWT_SECRET=TU_CLAVE_JWT_SEGURA_MINIMO_32_CARACTERES

# CORS - Configurar tu dominio
CORS_ORIGIN=https://tudominio.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**IMPORTANTE**: Generar una JWT_SECRET segura:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Deploy con Docker

### 1. Construir imágenes

```bash
docker-compose -f docker-compose.prod.yml build
```

### 2. Iniciar servicios

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Verificar estado

```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Inicializar base de datos

```bash
# Ejecutar schema
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d petshop_prod -f /docker-entrypoint-initdb.d/single_schema.sql

# Ejecutar seed (datos iniciales)
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d petshop_prod -f /docker-entrypoint-initdb.d/single_seed.sql
```

## Configuración de Nginx (Reverse Proxy)

Si usas Nginx como reverse proxy:

```nginx
server {
    listen 80;
    server_name tudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Backups Automáticos

### Script de backup diario

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/petshop"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="petshop_prod"
DB_USER="postgres"

mkdir -p $BACKUP_DIR

docker-compose -f /path/to/docker-compose.prod.yml exec -T db pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Mantener solo últimos 7 días
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Agregar a crontab:
```bash
0 2 * * * /path/to/backup.sh
```

## Seguridad - Checklist

- [ ] JWT_SECRET cambiado y seguro (mínimo 32 caracteres)
- [ ] DB_PASSWORD seguro y diferente al de desarrollo
- [ ] NODE_ENV=production
- [ ] CORS_ORIGIN configurado con dominio específico
- [ ] HTTPS habilitado
- [ ] Rate limiting activado
- [ ] Helmet middleware activado
- [ ] Backups automatizados
- [ ] Logs monitoreados

## Monitoreo

### Health Check

La aplicación expone un endpoint de health check:
```
GET /health
```

### Logs

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.prod.yml logs -f

# Ver logs de un servicio específico
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Troubleshooting

### Problema: No se puede conectar a la base de datos

Verificar:
1. Variables de entorno DB_* correctas
2. Contenedor de DB está corriendo: `docker-compose ps`
3. Network de Docker configurada correctamente

### Problema: CORS errors

Verificar:
1. CORS_ORIGIN configurado correctamente en .env
2. Reiniciar contenedores después de cambios

### Problema: JWT no válido

Verificar:
1. JWT_SECRET configurado y es la misma en todos los servicios
2. Token no expirado

## Actualización de la aplicación

```bash
# Pull de cambios
git pull origin main

# Reconstruir imágenes
docker-compose -f docker-compose.prod.yml build

# Reiniciar servicios
docker-compose -f docker-compose.prod.yml up -d

# Verificar estado
docker-compose -f docker-compose.prod.yml ps
```

## Soporte

Para problemas o preguntas, revisar:
- Logs de Docker: `docker-compose logs`
- Health check: `curl https://tudominio.com/health`
- Estado de contenedores: `docker-compose ps`
