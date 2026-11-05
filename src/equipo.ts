// Conocimiento del equipo del usuario: hardware, herramientas de desarrollo y programas instalados.
// Se guarda en %APPDATA%\Nahual\equipo.json y se actualiza cada 24 horas.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_DATOS } from './rutas';

export interface Programa {
  nombre: string;
  version: string;
  editor: string;
}

export interface Herramienta {
  ruta: string;
  version: string;
}

export interface Disco {
  unidad: string;
  libreGB: number;
  totalGB: number;
}

export interface Inventario {
  fecha: string;
  sistema: string;
  equipo: string;
  usuario: string;
  cpu: string;
  ramGB: number;
  gpus: string[];
  vram: string;
  discos: Disco[];
  herramientas: Record<string, Herramienta>;
  programas: Programa[];
}

const ARCHIVO = join(DIR_DATOS, 'equipo.json');
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

const HERRAMIENTAS = [
  'node', 'npm', 'pnpm', 'yarn', 'bun', 'deno', 'git', 'gh', 'python', 'py', 'pip', 'dotnet', 'cargo', 'rustc',
  'go', 'java', 'javac', 'docker', 'code', 'gcc', 'g++', 'clang', 'cmake', 'make', 'ollama', 'php', 'ruby',
  'choco', 'winget', 'flutter', 'adb',
];

const GUION = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
$vram = ''
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { $vram = (nvidia-smi --query-gpu=name,memory.total --format=csv,noheader) -join '; ' }
$discos = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  [pscustomobject]@{ unidad = $_.DeviceID; libreGB = [math]::Round($_.FreeSpace / 1GB); totalGB = [math]::Round($_.Size / 1GB) } })
$claves = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
          'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
          'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
$programas = @(Get-ItemProperty $claves | Where-Object { $_.DisplayName -and -not $_.SystemComponent -and $_.DisplayName -notmatch '^(KB\\d|Security Update|Update for)' } |
  Sort-Object DisplayName -Unique | ForEach-Object { [pscustomobject]@{ nombre = "$($_.DisplayName)"; version = "$($_.DisplayVersion)"; editor = "$($_.Publisher)" } })
$herramientas = [ordered]@{}
foreach ($h in @(${HERRAMIENTAS.map((h) => `'${h}'`).join(',')})) {
  $c = Get-Command $h -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) {
    $v = ''
    try { $v = [string](& $c.Source --version 2>&1 | Select-Object -First 1) } catch {}
    $herramientas[$h] = [pscustomobject]@{ ruta = $c.Source; version = $v.Trim() }
  }
}
[pscustomobject]@{
  sistema = "$($os.Caption) $($os.Version)"; equipo = $env:COMPUTERNAME; usuario = $env:USERNAME
  cpu = "$($cpu.Name.Trim()) ($($cpu.NumberOfCores) núcleos, $($cpu.NumberOfLogicalProcessors) hilos)"
  ramGB = [math]::Round($cs.TotalPhysicalMemory / 1GB); gpus = $gpus; vram = $vram; discos = $discos
  herramientas = $herramientas; programas = $programas
} | ConvertTo-Json -Depth 4 -Compress
`;

const comoLista = <T>(x: T | T[] | null | undefined): T[] => (Array.isArray(x) ? x : x ? [x] : []);

export function cargarEquipo(): Inventario | null {
  if (!existsSync(ARCHIVO)) return null;
  try {
    return JSON.parse(readFileSync(ARCHIVO, 'utf8')) as Inventario;
  } catch {
    return null;
  }
}

export function equipoVigente(inventario: Inventario | null): boolean {
  return !!inventario && Date.now() - Date.parse(inventario.fecha) < VIGENCIA_MS;
}

/** Recolecta el inventario del equipo con PowerShell (unos segundos) y lo guarda. */
export function recolectarEquipo(): Promise<Inventario | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  const codificado = Buffer.from(GUION, 'utf16le').toString('base64');
  return new Promise((resolver) => {
    const hijo = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', codificado], { windowsHide: true });
    let salida = '';
    hijo.stdout.on('data', (d: Buffer) => (salida += d.toString('utf8')));
    const reloj = setTimeout(() => hijo.kill(), 90000);
    hijo.on('error', () => resolver(null));
    hijo.on('close', () => {
      clearTimeout(reloj);
      try {
        const datos = JSON.parse(salida.slice(salida.indexOf('{'))) as Partial<Inventario>;
        const inventario: Inventario = {
          fecha: new Date().toISOString(),
          sistema: datos.sistema ?? '',
          equipo: datos.equipo ?? '',
          usuario: datos.usuario ?? '',
          cpu: datos.cpu ?? '',
          ramGB: datos.ramGB ?? 0,
          gpus: comoLista(datos.gpus),
          vram: datos.vram ?? '',
          discos: comoLista(datos.discos),
          herramientas: datos.herramientas ?? {},
          programas: comoLista(datos.programas),
        };
        mkdirSync(DIR_DATOS, { recursive: true });
        writeFileSync(ARCHIVO, JSON.stringify(inventario, null, 1));
        resolver(inventario);
      } catch {
        resolver(null);
      }
    });
  });
}

/** Resumen compacto del equipo para las indicaciones del modelo. */
export function resumenEquipo(inventario: Inventario | null, modelos: string[] = []): string {
  if (!inventario) return '## Tu equipo\n(Todavía no tengo el inventario de la computadora del usuario.)\n';
  const herramientas = Object.entries(inventario.herramientas)
    .map(([nombre, h]) => `${nombre} ${h.version.replace(/^[^\d]*/, '').split(' ')[0] || ''}`.trim())
    .join(', ');
  const discos = inventario.discos.map((d) => `${d.unidad} ${d.libreGB} GB libres de ${d.totalGB} GB`).join('; ');
  const nombres = inventario.programas.map((p) => p.nombre);
  const muestra = nombres.slice(0, 80).join(', ');
  return `## Tu equipo (la computadora del usuario; actualizado el ${inventario.fecha.slice(0, 10)})
- Sistema: ${inventario.sistema} · equipo «${inventario.equipo}» · usuario «${inventario.usuario}»
- Procesador: ${inventario.cpu} · Memoria RAM: ${inventario.ramGB} GB
- Tarjetas de video: ${inventario.gpus.join('; ')}${inventario.vram ? ` (${inventario.vram})` : ''}
- Discos: ${discos}
- Herramientas de desarrollo instaladas: ${herramientas || 'ninguna detectada'}
${modelos.length ? `- Modelos de Ollama instalados: ${modelos.join(', ')}\n` : ''}- Programas instalados (${nombres.length}): ${muestra}${nombres.length > 80 ? ', …' : ''}
Para saber si hay un programa concreto usa la acción equipo con buscar.
`;
}

export function buscarEnEquipo(inventario: Inventario, consulta: string): { texto: string; total: number } {
  const q = consulta.trim().toLowerCase();
  if (!q) return { texto: resumenEquipo(inventario), total: 1 };
  const programas = inventario.programas.filter((p) => `${p.nombre} ${p.editor}`.toLowerCase().includes(q));
  const herramientas = Object.entries(inventario.herramientas).filter(([n, h]) => `${n} ${h.ruta}`.toLowerCase().includes(q));
  const lineas = [
    ...herramientas.map(([n, h]) => `Herramienta: ${n} ${h.version} (${h.ruta})`),
    ...programas.slice(0, 40).map((p) => `Programa: ${p.nombre}${p.version ? ` ${p.version}` : ''}${p.editor ? ` · ${p.editor}` : ''}`),
  ];
  return { texto: lineas.length ? lineas.join('\n') : `No encontré «${consulta}» instalado en el equipo.`, total: lineas.length };
}
