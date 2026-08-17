# 检查 dev 所需端口是否被占用，如果被占用则杀掉占用进程
# 用法: 在 npm run dev 之前执行，或者作为 predev 钩子

$ports = @(3001, 5173)  # backend + web
$killed = $false

foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($conn in $conns) {
    $pid = $conn.OwningProcess
    if ($pid -and $pid -ne 0) {
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "[ports] Port $port occupied by $($proc.ProcessName) (PID $pid), killing..." -ForegroundColor Yellow
        try {
          Stop-Process -Id $pid -Force -ErrorAction Stop
          $killed = $true
        } catch {
          Write-Host "[ports] Failed to kill PID $pid : $_" -ForegroundColor Red
        }
      }
    }
  }
}

if ($killed) {
  Write-Host "[ports] Waiting 1s for ports to release..." -ForegroundColor Yellow
  Start-Sleep -Seconds 1
}

# 再检查一次
$stillBlocked = $false
foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($conns) {
    Write-Host "[ports] Port $port still occupied!" -ForegroundColor Red
    $stillBlocked = $true
  }
}

if (-not $stillBlocked) {
  Write-Host "[ports] All ports (3001, 5173) are free" -ForegroundColor Green
}
