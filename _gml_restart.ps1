$ErrorActionPreference = "Continue"
$base = "C:\Users\joaoh\OneDrive\Desktop\controle de viaturas"

# 1) Encerrar qualquer processo escutando na porta 5000
$conns = netstat -ano | Select-String ":5000\s"
foreach ($c in $conns) {
    $parts = ($c.ToString().Trim() -split '\s+')
    $pidPorta = $parts[$parts.Count - 1]
    if ($pidPorta -match '^\d+$') {
        Write-Output "Encerrando PID $pidPorta (porta 5000)"
        taskkill /PID $pidPorta /F 2>$null | Out-Null
    }
}
Start-Sleep -Seconds 2

# 2) Logs novos (evita arquivo travado por processo antigo)
$log = Join-Path $env:TEMP "gml-server2.log"
$err = Join-Path $env:TEMP "gml-server2.err.log"
Remove-Item $log, $err -Force -ErrorAction SilentlyContinue

# 3) Iniciar servidor
$env:PYTHONPATH = $base
$proc = Start-Process -FilePath "python" -ArgumentList "api\index.py" -WorkingDirectory $base -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
Write-Output "Servidor iniciado - PID: $($proc.Id)"

Start-Sleep -Seconds 10

# 4) Testes
$h = & curl.exe -s -m 10 -o "$env:TEMP\gml-health2.txt" -w "HTTP %{http_code}" http://localhost:5000/api/health
Write-Output "HEALTH: $h"
Get-Content "$env:TEMP\gml-health2.txt" -ErrorAction SilentlyContinue
$d = & curl.exe -s -m 10 -o "$env:TEMP\gml-dash2.txt" -w "HTTP %{http_code}" http://localhost:5000/dashboard.html
Write-Output "DASHBOARD: $d"

# 5) Erros do servidor (se houver)
$errContent = Get-Content $err -Tail 10 -ErrorAction SilentlyContinue
if ($errContent) {
    Write-Output "--- ERR LOG ---"
    $errContent
} else {
    Write-Output "--- SEM ERROS NO LOG ---"
}
