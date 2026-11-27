. './scripts/set-build-number.ps1'
npm run build:all

foreach ($port in 5173, 8080) {
  $proc = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  if ($proc) { Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue }
}

npx --no-install concurrently -n SERVER,CLIENT -c yellow,blue "node dist/server/server.js" "npm run dev"
