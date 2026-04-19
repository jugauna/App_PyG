# Espera a que FastAPI responda (run_app.bat). No usar $variables dentro de lineas largas en .bat.
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/openapi.json' -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            Write-Host '[PyG] API lista.'
            exit 0
        }
    } catch {
        # aun no levanta
    }
    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host '[PyG] API lista (puerto en escucha).'
        exit 0
    }
    Start-Sleep -Seconds 1
}
Write-Host '[PyG] ERROR: la API no respondio. Revisa la ventana PyG Backend. Manual: backend\start_api.bat' -ForegroundColor Red
exit 1
