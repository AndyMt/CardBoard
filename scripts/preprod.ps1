. './scripts/set-build-number.ps1'
$env:NODE_ENV = 'production'
$env:PORT = '8080'
npm run build:all
New-Item -ItemType Directory -Path data -Force
New-Item -ItemType Directory -Path data/backups -Force

$proc = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($proc) { Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue }

node dist/server/server.js
