# Mo psql vao database demo. Trong psql go:  \i /tmp/qp/tn1_chon.sql  (tn2_ket, tn3_doanh_thu, tn4_gom_ve, tn5_toi_uu)
# Neu vua sua file .sql trong thu muc pg\, chep lai:  .\psql.ps1 -Sync
param([switch]$Sync)
$c = 'ticketrush-postgres'
if ($Sync) { docker cp "$PSScriptRoot\pg\." "${c}:/tmp/qp" }
docker exec -it $c psql -U ticketrush -d ticketrush_qp
