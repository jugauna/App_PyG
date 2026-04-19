@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Evita fallos del file watcher en algunas carpetas/redes de Windows
set WATCHFILES_FORCE_POLLING=1

echo [PyG Backend] Carpeta: %CD%
echo [PyG Backend] Python: "%CD%\.venv\Scripts\python.exe"
if not exist ".venv\Scripts\python.exe" (
  echo ERROR: Falta .venv\Scripts\python.exe — crea el venv e instala requirements.
  pause
  exit /b 1
)

"%CD%\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
echo.
echo [PyG Backend] Uvicorn termino (codigo %ERRORLEVEL%^). Revisa errores arriba.
pause
