@echo off
setlocal EnableDelayedExpansion

REM Configurar variables
set PGPASSWORD=dbpass
set LOG_FILE=INICIAR_SISTEMA_LOG.txt
set TIMESTAMP=%date:~-4,4%-%date:~-10,2%-%date:~-7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%

REM Limpiar log anterior
if exist %LOG_FILE% del %LOG_FILE%

echo. >> %LOG_FILE%
echo ================================================ >> %LOG_FILE%
echo INICIO: %TIMESTAMP% >> %LOG_FILE%
echo ================================================ >> %LOG_FILE%
echo. >> %LOG_FILE%

echo ========================================
echo   Pet Shop Management System
echo   Single-Company Architecture
echo   Iniciando sistema...
echo ========================================
echo.
echo [LOG] Revisa %LOG_FILE% para detalles
echo.

:CHECK_POSTGRES
echo [1/6] Verificando PostgreSQL...
echo [1/6] Verificando PostgreSQL... >> %LOG_FILE%
where psql >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] PostgreSQL no esta instalado o no esta en el PATH.
    echo [ERROR] PostgreSQL no esta instalado o no esta en el PATH. >> %LOG_FILE%
    echo Por favor instale PostgreSQL primero.
    pause
    exit /b 1
)
echo [OK] PostgreSQL detectado.
echo [OK] PostgreSQL detectado. >> %LOG_FILE%

:CHECK_NODE
echo [2/6] Verificando Node.js...
echo [2/6] Verificando Node.js... >> %LOG_FILE%
where node >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo [ERROR] Node.js no esta instalado. >> %LOG_FILE%
    echo Por favor instale Node.js primero.
    pause
    exit /b 1
)
echo [OK] Node.js detectado.
echo [OK] Node.js detectado. >> %LOG_FILE%

:DB_SETUP
echo.
echo [3/6] Verificando base de datos unica (petshop_app)...
echo [3/6] Verificando base de datos unica... >> %LOG_FILE%

REM Verificar si existe la base de datos
echo [DEBUG] Listando bases de datos... >> %LOG_FILE%
psql -U postgres -lqt 2>>%LOG_FILE% | findstr /C:"petshop_app" >nul
if !ERRORLEVEL! NEQ 0 (
    REM Primero verificar si es problema de login
    psql -U postgres -c "SELECT 1;" >nul 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] No se puede conectar a PostgreSQL con user 'postgres'
        echo [ERROR] Verifique contraseña y que PostgreSQL este corriendo >> %LOG_FILE%
        echo.
        echo Soluciones:
        echo 1. Ejecutar TEST_LOGIN_POSTGRES.bat para diagnosticar
        echo 2. Si la password es diferente, ejecutar RESET_POSTGRES_PASSWORD.bat
        echo 3. Verificar que PostgreSQL este activo
        echo.
        pause
        exit /b 1
    )
    
    echo [INFO] Base de datos no existe. Creando...
    echo [INFO] Creando petshop_app... >> %LOG_FILE%
    psql -U postgres -c "CREATE DATABASE petshop_app;" 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] No se pudo crear la base de datos.
        echo [ERROR] Ver detalles en %LOG_FILE%
        echo [ERROR] ErrorLevel: !ERRORLEVEL! >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Base de datos creada.
    echo [OK] Base de datos creada. >> %LOG_FILE%

    echo [INFO] Creando esquema y tablas (login + datos)...
    echo [INFO] Ejecutando single_schema.sql... >> %LOG_FILE%
    psql -U postgres -d petshop_app -f "database\single_schema.sql" 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Error al crear esquema.
        echo [ERROR] Ver detalles en %LOG_FILE%
        echo [ERROR] ErrorLevel: !ERRORLEVEL! >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Esquema y tablas creadas.
    echo [OK] Esquema creado. >> %LOG_FILE%

    echo [INFO] Insertando datos iniciales...
    echo [INFO] Ejecutando single_seed.sql... >> %LOG_FILE%
    psql -U postgres -d petshop_app -f "database\single_seed.sql" 2>>%LOG_FILE%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Error al insertar datos iniciales.
        echo [ERROR] Ver detalles en %LOG_FILE%
        echo [ERROR] ErrorLevel: !ERRORLEVEL! >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Base de datos inicializada correctamente.
    echo [OK] Base de datos inicializada. >> %LOG_FILE%
) else (
    echo [INFO] Base de datos petshop_app existe. Verificando estructura...
    echo [INFO] BD existe - verificando estructura... >> %LOG_FILE%
    
    REM Verificar si la tabla usuarios existe (tabla clave de autenticacion)
    echo [DEBUG] Contando tabla usuarios... >> %LOG_FILE%
    for /f %%A in ('psql -U postgres -d petshop_app -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='usuarios';" 2>>%LOG_FILE%') do set TABLE_COUNT=%%A
    
    echo [DEBUG] TABLE_COUNT=!TABLE_COUNT! >> %LOG_FILE%
    
    if "!TABLE_COUNT!"=="0" (
        echo [WARN] Estructura incompleta. Recreando esquema y tablas...
        echo [WARN] Tabla usuarios no encontrada - recreando... >> %LOG_FILE%
        psql -U postgres -d petshop_app -f "database\single_schema.sql" 2>>%LOG_FILE%
        if !ERRORLEVEL! NEQ 0 (
            echo [ERROR] Error al crear esquema.
            echo [ERROR] Ver detalles en %LOG_FILE%
            echo [ERROR] ErrorLevel: !ERRORLEVEL! >> %LOG_FILE%
            pause
            exit /b 1
        )
        echo [INFO] Insertando datos iniciales...
        psql -U postgres -d petshop_app -f "database\single_seed.sql" 2>>%LOG_FILE%
        if !ERRORLEVEL! NEQ 0 (
            echo [ERROR] Error al insertar datos iniciales.
            echo [ERROR] Ver detalles en %LOG_FILE%
            echo [ERROR] ErrorLevel: !ERRORLEVEL! >> %LOG_FILE%
            pause
            exit /b 1
        )
        echo [OK] Base de datos reinicializada correctamente.
        echo [OK] Base de datos reinicializada. >> %LOG_FILE%
    ) else (
        echo [OK] Base de datos con estructura correcta. Listo.
        echo [OK] Estructura OK - tabla usuarios existe. >> %LOG_FILE%
    )
)

:ENV_SETUP
echo.
echo [4/6] Configurando variables de entorno...
echo [4/6] Configurando .env... >> %LOG_FILE%
if not exist backend\.env (
    echo [INFO] Creando archivo .env...
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
        echo [ERROR] ErrorLevel: !ERRORLEVEL! >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Archivo .env creado.
    echo [OK] Archivo .env creado. >> %LOG_FILE%
) else (
    echo [OK] Archivo .env ya existe.
    echo [OK] Archivo .env existe. >> %LOG_FILE%
)

:INSTALL_DEPS
echo.
echo [5/5] Verificando dependencias...
echo [5/5] Verificando dependencias... >> %LOG_FILE%
if not exist "backend\node_modules" (
    echo [INFO] Instalando dependencias backend...
    echo [INFO] npm install backend... >> %LOG_FILE%
    cd backend
    call npm install 2>>../INICIAR_SISTEMA_LOG.txt
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Error instalando dependencias backend
        echo [ERROR] ErrorLevel: !ERRORLEVEL! >> ../INICIAR_SISTEMA_LOG.txt
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Backend instalado.
    echo [OK] Backend instalado. >> %LOG_FILE%
)
if not exist "frontend\node_modules" (
    echo [INFO] Instalando dependencias frontend...
    echo [INFO] npm install frontend... >> %LOG_FILE%
    cd frontend
    call npm install 2>>../INICIAR_SISTEMA_LOG.txt
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Error instalando dependencias frontend
        echo [ERROR] ErrorLevel: !ERRORLEVEL! >> ../INICIAR_SISTEMA_LOG.txt
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend instalado.
    echo [OK] Frontend instalado. >> %LOG_FILE%
)
echo [OK] Dependencias listas.
echo [OK] Dependencias listas. >> %LOG_FILE%

:RUN_SERVERS
echo.
echo ======================================== >> %LOG_FILE%
echo   Iniciando Servidores >> %LOG_FILE%
echo ======================================== >> %LOG_FILE%
echo.
echo ========================================
echo   Iniciando Servidores...
echo ========================================
echo.
echo [INFO] Iniciando backend en http://localhost:3000...
echo [INFO] Iniciando backend... >> %LOG_FILE%
start "PetShop Backend" cmd /k "cd backend && npm start"
timeout /t 3 >nul

echo [INFO] Iniciando frontend en http://localhost:5173...
echo [INFO] Iniciando frontend... >> %LOG_FILE%
start "PetShop Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul

echo.
echo ========================================
echo   SISTEMA INICIADO CORRECTAMENTE
echo ========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Credenciales de Acceso (single-company):
echo Usuario: admin          / Pass: admin123
echo Usuario: vendedor1      / Pass: admin123
echo Usuario: gerente        / Pass: admin123
echo.
echo Base de Datos: petshop_app
echo Arquitectura: Single-Company
echo.
echo LOG: %LOG_FILE%
echo.
echo Presione una tecla para cerrar esta ventana.
echo (Los servidores seguiran corriendo en background)
echo. >> %LOG_FILE%
echo ======================================== >> %LOG_FILE%
echo FIN: %date:~-4,4%-%date:~-10,2%-%date:~-7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2% >> %LOG_FILE%
echo ======================================== >> %LOG_FILE%
pause
