#!/bin/bash

echo "========================================"
echo "  Pet Shop Management System (SINGLE DB)"
echo "  Iniciando sistema..."
echo "========================================"
echo ""

# Check requirements
if ! command -v psql &> /dev/null || ! command -v node &> /dev/null; then
    echo "[ERROR] PostgreSQL y Node.js son requeridos"
    exit 1
fi

echo "[1/4] Verificando base de datos..."
if ! psql -U postgres -lqt | cut -d \| -f 1 | grep -qw petshop_app; then
    echo "Creando base de datos petshop_app..."
    psql -U postgres -c "CREATE DATABASE petshop_app;"
    psql -U postgres -d petshop_app -f database/single_schema.sql
    psql -U postgres -d petshop_app -f database/single_seed.sql
    echo "Base de datos inicializada!"
else
    echo "Base de datos ya existe"
fi

echo ""
echo "[MIGRATIONS] Aplicando migraciones seguras (database/migrations/*.sql)..."
# Ensure schema_migrations table exists
psql -U postgres -d petshop_app -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());"

for f in database/migrations/*.sql; do
    if [ -f "$f" ]; then
        fname=$(basename "$f")
        applied=$(psql -U postgres -d petshop_app -tAc "SELECT 1 FROM schema_migrations WHERE filename='$fname'")
        if [ "$applied" = "1" ]; then
            echo "[MIG] $fname already applied, skipping"
        else
            echo "[MIG] Applying $fname"
            # Stop on error to avoid partial state
            psql -U postgres -d petshop_app -v ON_ERROR_STOP=1 -f "$f"
            if [ $? -ne 0 ]; then
                echo "[ERROR] Migration failed: $fname"
                exit 1
            fi
            psql -U postgres -d petshop_app -c "INSERT INTO schema_migrations(filename) VALUES('$fname')"
            echo "[MIG] Applied $fname"
        fi
    fi
done
echo "[MIG] Migraciones finalizadas"

echo ""
echo "[2/4] Configurando entorno..."
if [ ! -f .env ]; then
    cp .env.example .env
fi

echo ""
echo "[3/4] Instalando dependencias..."
(cd backend && [ ! -d node_modules ] && npm install)
(cd frontend && [ ! -d node_modules ] && npm install)

echo ""
echo "[4/4] Iniciando servidores..."
(cd backend && npm start &)
BACKEND_PID=$!
(cd frontend && npm run dev &)
FRONTEND_PID=$!

echo ""
echo "Sistema en linea!"
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""

wait $BACKEND_PID $FRONTEND_PID
