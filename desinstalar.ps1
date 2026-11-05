# Desinstalador de Forja. Quita el programa, el comando "forja" y los accesos directos.
# NO borra tus proyectos (Documentos\Forja) ni tus ajustes (%APPDATA%\Forja).
$destino = Join-Path $env:LOCALAPPDATA 'Programs\Forja'

$r = Read-Host "Se eliminará Forja de $destino (incluidas sus mejoras). ¿Continuar? (s/n)"
if ($r -notin @('s', 'si', 'sí')) { Write-Host 'Cancelado.'; exit }

npm unlink -g forja --silent 2>$null
foreach ($lnk in @(
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Forja.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Forja.lnk'))) {
  if (Test-Path $lnk) { Remove-Item $lnk }
}
Set-Location $env:TEMP
Remove-Item -Recurse -Force $destino
Write-Host '✔ Forja desinstalada. Tus proyectos y ajustes se conservan.' -ForegroundColor Green
