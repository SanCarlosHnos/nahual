# Instalador de Forja para Windows.
# Copia Forja a %LOCALAPPDATA%\Programs\Forja, instala dependencias, registra el comando "forja"
# y crea accesos directos en el menú Inicio y el escritorio.
# Si ya está instalada, NO la sobrescribe (conserva sus mejoras); solo repara dependencias y accesos.
$ErrorActionPreference = 'Stop'

$origen    = $PSScriptRoot
$destino   = Join-Path $env:LOCALAPPDATA 'Programs\Forja'
$datos     = Join-Path $env:APPDATA 'Forja'
$proyectos = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Forja'

foreach ($c in 'node', 'npm', 'git') {
  if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { throw "Falta '$c'. Instálalo y vuelve a ejecutar el instalador." }
}
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { Write-Warning 'No se encontró Ollama: Forja lo necesita para pensar.' }

if (Test-Path (Join-Path $destino '.git')) {
  Write-Host "Forja ya está instalada en $destino; se conservan sus mejoras." -ForegroundColor Yellow
} else {
  Write-Host "Instalando Forja en $destino…" -ForegroundColor Cyan
  git clone --quiet "$origen" "$destino"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar Forja.' }
  git -C "$destino" remote remove origin
  git -C "$destino" config user.email 'forja@local'
  git -C "$destino" config user.name 'Forja'
  git -C "$destino" tag fabrica
  git -C "$destino" tag ultima-buena
}

Push-Location $destino
try {
  Write-Host 'Instalando dependencias…' -ForegroundColor Cyan
  npm ci --silent --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Falló npm ci.' }
  Write-Host 'Registrando el comando "forja"…' -ForegroundColor Cyan
  npm link --silent --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Falló npm link.' }
} finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $datos, $proyectos | Out-Null
$cfg = Join-Path $datos 'config.json'
if (-not (Test-Path $cfg)) {
  $json = @{ carpetaProyectos = $proyectos } | ConvertTo-Json
  [IO.File]::WriteAllText($cfg, $json, (New-Object Text.UTF8Encoding $false))
}

$node = (Get-Command node).Source
$supervisor = Join-Path $destino 'supervisor.mjs'
$wsh = New-Object -ComObject WScript.Shell
$accesos = @(
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Forja.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Forja.lnk')
)
foreach ($lnk in $accesos) {
  $s = $wsh.CreateShortcut($lnk)
  $s.TargetPath = $env:ComSpec
  $s.Arguments = "/c `"title Forja && `"$node`" `"$supervisor`" || pause`""
  $s.WorkingDirectory = $proyectos
  $s.IconLocation = "$node,0"
  $s.Description = 'Forja: IA local que construye software y se mejora a sí misma'
  $s.Save()
}

Write-Host ''
Write-Host '✔ Forja instalada.' -ForegroundColor Green
Write-Host "  Programa:   $destino"
Write-Host "  Proyectos:  $proyectos"
Write-Host "  Ajustes:    $cfg"
Write-Host '  Ábrela desde el menú Inicio o el escritorio ("Forja"), o escribe "forja" en cualquier terminal.'
