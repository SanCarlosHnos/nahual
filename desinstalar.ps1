# Desinstalador de Nahual. Quita el programa, el comando "nahual" y los accesos directos.
# NO borra tus proyectos (Documentos\Nahual) ni tus ajustes (%APPDATA%\Nahual).
$destino = Join-Path $env:LOCALAPPDATA 'Programs\Nahual'

$r = Read-Host "Se eliminará Nahual de $destino (incluidas sus mejoras). ¿Continuar? (s/n)"
if ($r -notin @('s', 'si', 'sí')) { Write-Host 'Cancelado.'; exit }

npm unlink -g nahual --silent 2>$null
foreach ($lnk in @(
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Nahual.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nahual.lnk'))) {
  if (Test-Path $lnk) { Remove-Item $lnk }
}
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  $q = Read-Host '¿Borro también el modelo "nahual" de Ollama? (s/n)'
  if ($q -in @('s', 'si', 'sí')) { & ollama rm nahual 2>$null }
}
Set-Location $env:TEMP
Remove-Item -Recurse -Force $destino
Write-Host 'Nahual desinstalado. Tus proyectos y ajustes se conservan.' -ForegroundColor Green
