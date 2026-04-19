@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ============================================
echo   PyG — Plataforma fullstack
echo   FastAPI + React + DuckDB/Parquet
echo   Raiz: %CD%
echo Punto de entrada unico: este script
echo ============================================
echo.

rem --- Liberar puertos 8000 y 5173 (requiere PowerShell; ignora errores) ---
powershell -NoProfile -Command ^
  "$ports=@(8000,5173); foreach($p in $ports){ Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue ^| ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {} } }" 2>nul
echo [PyG] Intentado liberar puertos 8000 y 5173.
echo.

rem --- Dependencias frontend ---
if not exist "frontend\package.json" (
  echo ERROR: No se encontro frontend\package.json
  pause
  exit /b 1
)
if not exist "frontend\node_modules\" (
  echo [PyG] node_modules no existe. Ejecutando npm install en frontend...
  pushd frontend
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install fallo.
    popd
    pause
    exit /b 1
  )
  popd
  echo.
)

rem --- Backend: venv ---
if not exist "backend\.venv\Scripts\python.exe" (
  echo ERROR: No existe backend\.venv
  echo Crear con:  cd backend
  echo              python -m venv .venv
  echo              .venv\Scripts\pip install -r requirements.txt
  pause
  exit /b 1
)

echo [PyG] Iniciando API FastAPI en puerto 8000 (nueva ventana)...
rem Usa backend\start_api.bat (python.exe del venv sin activate.bat — evita PATH roto en cmd /k).
rem La ventana "PyG Backend" debe quedar abierta.
start "PyG Backend" cmd /k call "%~dp0backend\start_api.bat"

echo [PyG] Esperando respuesta de la API (hasta ~45 s^)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait_api.ps1"
if errorlevel 1 echo.

echo [PyG] Iniciando frontend React/Vite en puerto 5173 (nueva ventana)...
start "PyG Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo [PyG] Abriendo el navegador en ~6 s (http://localhost:5173^)...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Listo — stack PyG en marcha.
echo   API (FastAPI):  http://localhost:8000/docs
echo   Web (React):    http://localhost:5173
echo Cerrá las ventanas "PyG Backend" y "PyG Frontend" para detener todo.
echo.
pause
