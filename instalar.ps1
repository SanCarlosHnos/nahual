# Instalador de Nahual para Windows.
# Copia Nahual a %LOCALAPPDATA%\Programs\Nahual, instala dependencias, registra el comando "nahual",
# crea el modelo propio en Ollama y crea accesos directos en el menú Inicio y el escritorio.
# Si ya está instalado, NO lo sobrescribe (conserva sus mejoras); solo repara dependencias y accesos.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$origen    = $PSScriptRoot
$destino   = Join-Path $env:LOCALAPPDATA 'Programs\Nahual'
$datos     = Join-Path $env:APPDATA 'Nahual'
$proyectos = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Nahual'

foreach ($c in 'node', 'npm', 'git') {
  if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { throw "Falta '$c'. Instálalo y vuelve a ejecutar el instalador." }
}
$hayOllama = [bool](Get-Command ollama -ErrorAction SilentlyContinue)
if (-not $hayOllama) { Write-Warning 'No encontré Ollama. Nahual lo necesita para pensar: instálalo desde https://ollama.com' }

if (Test-Path (Join-Path $destino '.git')) {
  Write-Host "Nahual ya está instalado en $destino; conservo sus mejoras." -ForegroundColor Yellow
} else {
  Write-Host "Instalando Nahual en $destino..." -ForegroundColor Cyan
  git clone --quiet "$origen" "$destino"
  if ($LASTEXITCODE -ne 0) { throw 'No pude copiar Nahual.' }
  cmd /c "git -C ""$destino"" remote remove origin" 2>$null | Out-Null
  cmd /c "git -C ""$destino"" config user.email nahual@local" | Out-Null
  cmd /c "git -C ""$destino"" config user.name Nahual" | Out-Null
  # La versión instalada en este momento es la "fábrica" y la "última buena".
  cmd /c "git -C ""$destino"" tag -f fabrica" 2>$null | Out-Null
  cmd /c "git -C ""$destino"" tag -f ultima-buena" 2>$null | Out-Null
}

Push-Location $destino
try {
  Write-Host 'Instalando dependencias...' -ForegroundColor Cyan
  npm ci --silent --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Falló npm ci.' }
  Write-Host 'Registrando el comando "nahual"...' -ForegroundColor Cyan
  npm link --silent --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Falló npm link.' }
} finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $datos, $proyectos | Out-Null
$cfg = Join-Path $datos 'config.json'
if (-not (Test-Path $cfg)) {
  $json = @{ carpetaProyectos = $proyectos } | ConvertTo-Json
  [IO.File]::WriteAllText($cfg, $json, (New-Object Text.UTF8Encoding $false))
}

# Crear el modelo propio de Ollama (usa el modelo base si ya está descargado).
if ($hayOllama) {
  $base = 'huihui_ai/qwen2.5-coder-abliterate:14b'
  $modelos = (& ollama list) -join "`n"
  if ($modelos -notmatch [regex]::Escape($base)) {
    Write-Host "El modelo base $base no está descargado." -ForegroundColor Yellow
    $r = Read-Host "¿Lo descargo ahora? Son unos 9 GB (s/n)"
    if ($r -in @('s', 'si', 'sí')) { & ollama pull $base }
  }
  if (((& ollama list) -join "`n") -match [regex]::Escape($base)) {
    Write-Host 'Creando el modelo "nahual" en Ollama...' -ForegroundColor Cyan
    & node (Join-Path $destino 'node_modules\tsx\dist\cli.mjs') (Join-Path $destino 'src\modelo.ts') --crear
  } else {
    Write-Warning 'No creé el modelo "nahual". Cuando descargues el modelo base, ejecuta dentro de la carpeta de Nahual: npm run start y usa /modelo, o vuelve a correr el instalador.'
  }
}

$node = (Get-Command node).Source
$supervisor = Join-Path $destino 'supervisor.mjs'
$wsh = New-Object -ComObject WScript.Shell
foreach ($lnk in @(
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Nahual.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nahual.lnk'))) {
  $s = $wsh.CreateShortcut($lnk)
  $s.TargetPath = $env:ComSpec
  $s.Arguments = "/c `"title Nahual && `"$node`" `"$supervisor`" || pause`""
  $s.WorkingDirectory = $proyectos
  $s.IconLocation = "$node,0"
  $s.Description = 'Nahual: IA local que construye software y se mejora a sí misma'
  $s.Save()
}

Write-Host ''
Write-Host 'Nahual instalado.' -ForegroundColor Green
Write-Host "  Programa:   $destino"
Write-Host "  Proyectos:  $proyectos"
Write-Host "  Ajustes:    $cfg"
Write-Host '  Abrelo desde el menu Inicio o el escritorio ("Nahual"), o escribe "nahual" en cualquier terminal.'
