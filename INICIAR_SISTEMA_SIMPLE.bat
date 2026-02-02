@echo off
setlocal EnableDelayedExpansion

REM Configurar variables
set PGPASSWORD=dbpass
set LOG_FILE=INICIAR_SISTEMA_LOG.txt

REM Limpiar log anterior
if exist %LOG_FILE% del %LOG_FILE%

echo. >> %LOG_FILE%
echo ================================================ >> %LOG_FILE%
echo INICIO: %date% %time% >> %LOG_FILE%
echo ================================================ >> %LOG_FILE%

echo ========================================
echo   Pet Shop Management System
echo   Iniciando sistema...
echo ========================================
echo.
echo Ver detalles en: %LOG_FILE%
echo.

REM ==========================================
REM PASO 1: Verificar PostgreSQL
REM ==========================================
echo [1/5] Verificando PostgreSQL...
echo [1/5] Verificando PostgreSQL... >> %LOG_FILE%

where psql >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] PostgreSQL no encontrado en PATH
    echo [ERROR] PostgreSQL no encontrado >> %LOG_FILE%
    pause
    exit /b 1
)
echo [OK] PostgreSQL disponible

REM ==========================================
REM PASO 2: Verificar conexion a PostgreSQL
REM ==========================================
echo [2/5] Verificando conexion a PostgreSQL...
echo [2/5] Verificando conexion a PostgreSQL... >> %LOG_FILE%

psql -U postgres -h localhost -c "SELECT 1;" >nul 2>>%LOG_FILE%
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] No se puede conectar a PostgreSQL
    echo [ERROR] Usuario: postgres, Password: dbpass
    echo [ERROR] Ejecutar: TEST_LOGIN_POSTGRES.bat
    echo [ERROR] Fallo de conexion >> %LOG_FILE%
    pause
    exit /b 1
)
echo [OK] Conexion a PostgreSQL exitosa

REM ==========================================
REM PASO 3: Verificar/crear base de datos
REM ==========================================
echo [3/5] Configurando base de datos petshop_app...
echo [3/5] Configurando BD... >> %LOG_FILE%

REM Verificar si existe
psql -U postgres -h localhost -lqt 2>>%LOG_FILE% | findstr /C:"petshop_app" >nul
if !ERRORLEVEL! EQU 0 (
    echo [OK] BD petshop_app existe
    echo [OK] BD existe >> %LOG_FILE%
) else (
    echo [INFO] Creando BD petshop_app...
    echo [INFO] Creando BD... >> %LOG_FILE%
    psql -U postgres -h localhost -c "CREATE DATABASE petshop_app;" 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] No se pudo crear la BD
        echo [ERROR] Crear BD fallo >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] BD creada
    echo [OK] BD creada >> %LOG_FILE%
    
    REM Crear schema
    echo [INFO] Creando tablas...
    echo [INFO] Creando tablas... >> %LOG_FILE%
    psql -U postgres -h localhost -d petshop_app -f "database\single_schema.sql" 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Error creando tablas
        echo [ERROR] Schema fallo >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Tablas creadas
    echo [OK] Tablas creadas >> %LOG_FILE%
    
    REM Insertar datos iniciales
    echo [INFO] Insertando datos iniciales...
    echo [INFO] Insertando datos... >> %LOG_FILE%
    psql -U postgres -h localhost -d petshop_app -f "database\single_seed.sql" 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Error insertando datos
        echo [ERROR] Seed fallo >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Datos iniciales insertados
    echo [OK] Datos insertados >> %LOG_FILE%
)

REM ==========================================
REM PASO 4: Configurar .env
REM ==========================================
echo [4/5] Configurando variables de entorno...
echo [4/5] Configurando .env... >> %LOG_FILE%

if not exist backend\.env (
    echo [INFO] Creando backend\.env...
    (
        echo DB_HOST=localhost
        echo DB_PORT=5432
        echo DB_NAME=petshop_app
        echo DB_USER=postgres
        echo DB_PASSWORD=dbpass
        echo JWT_SECRET=Axoft1988@32233
        echo NODE_ENV=development
        echo PORT=3000
    ) > backend\.env
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] No se pudo crear .env
        echo [ERROR] Crear .env fallo >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] backend\.env creado
    echo [OK] .env creado >> %LOG_FILE%
) else (
    echo [OK] backend\.env ya existe
    echo [OK] .env existe >> %LOG_FILE%
)

REM ==========================================
REM PASO 5: Instalar dependencias
REM ==========================================
echo [5/5] Verificando dependencias...
echo [5/5] Verificando dependencias... >> %LOG_FILE%

if not exist "backend\node_modules" (
    echo [INFO] Instalando backend...
    echo [INFO] npm install backend... >> %LOG_FILE%
    cd backend
    call npm install >>../INICIAR_SISTEMA_LOG.txt 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install backend fallo
        echo [ERROR] npm backend fallo >> ../INICIAR_SISTEMA_LOG.txt
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Backend instalado
    echo [OK] Backend OK >> %LOG_FILE%
)

if not exist "frontend\node_modules" (
    echo [INFO] Instalando frontend...
    echo [INFO] npm install frontend... >> %LOG_FILE%
    cd frontend
    call npm install >>../INICIAR_SISTEMA_LOG.txt 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install frontend fallo
        echo [ERROR] npm frontend fallo >> ../INICIAR_SISTEMA_LOG.txt
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend instalado
    echo [OK] Frontend OK >> %LOG_FILE%
)

echo [OK] Dependencias listas
echo [OK] Dependencias OK >> %LOG_FILE%

REM ==========================================
REM INICIAR SERVIDORES
REM ==========================================
echo.
echo ========================================
echo   INICIANDO SERVIDORES
echo ========================================
echo.

echo [INFO] Backend en http://localhost:3000
start "PetShop Backend" cmd /k "cd backend && npm start"
timeout /t 3 >nul

echo [INFO] Frontend en http://localhost:5173
start "PetShop Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul

echo.
echo ========================================
echo   SISTEMA INICIADO
echo ========================================
echo.
echo Usuario: admin      / Pass: admin123
echo Usuario: vendedor1  / Pass: admin123
echo Usuario: gerente    / Pass: admin123
echo.
echo DB: petshop_app
echo Log: %LOG_FILE%
echo.

echo [OK] Sistema iniciado >> %LOG_FILE%
echo ================================================ >> %LOG_FILE%
echo FIN: %date% %time% >> %LOG_FILE%
echo ================================================ >> %LOG_FILE%

pause
