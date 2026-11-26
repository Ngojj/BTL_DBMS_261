# Nap bo du lieu cua muc 3.3 vao database rieng ticketrush_qp trong container PostgreSQL cua du an.
# Khong dung toi database ticketrush cua ung dung. Chay: powershell -ExecutionPolicy Bypass -File .\setup.ps1
$c = 'ticketrush-postgres'
function Run($what) { if ($LASTEXITCODE -ne 0) { Write-Host "LOI o buoc: $what" -ForegroundColor Red; exit 1 } }

Write-Host '1/3 Tao database ticketrush_qp ...'
docker exec $c psql -U ticketrush -d postgres -c "DROP DATABASE IF EXISTS ticketrush_qp" -c "CREATE DATABASE ticketrush_qp"; Run 'tao database (container ticketrush-postgres da chay chua? npm run db:up)'

Write-Host '2/3 Chep script va du lieu vao container (/tmp/qp) ...'
docker exec $c rm -rf /tmp/qp; docker exec $c mkdir -p /tmp/qp; Run 'tao thu muc'
docker cp "$PSScriptRoot\pg\." "${c}:/tmp/qp"; Run 'docker cp'

Write-Host '3/3 Nap du lieu va tao chi muc (khoang 1 phut) ...'
docker exec $c psql -U ticketrush -d ticketrush_qp -v ON_ERROR_STOP=1 -f /tmp/qp/load.sql; Run 'nap du lieu'

Write-Host 'Xong. Mo psql de demo:  .\psql.ps1' -ForegroundColor Green
