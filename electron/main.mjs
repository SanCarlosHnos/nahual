// PROCESO PRINCIPAL DE ELECTRON — archivo protegido: Nahual no puede modificarlo.
// Crea la ventana, lanza el motor (src/principal.ts) como proceso hijo y hace de puente
// entre el motor y la ventana. Cuando el motor pide mejorarse (código 43), ejecuta la
// mejora con el guardián y recarga el motor, todo dentro de la misma ventana.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import { git } from '../nucleo/guardian.mjs';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const TSX = join(RAIZ, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const NODE = process.env.NAHUAL_NODE || 'node';
const DATOS = process.env.NAHUAL_DATOS || join(process.env.APPDATA || join(homedir(), '.config'), 'Nahual');
const PETICION = process.env.NAHUAL_PETICION || join(DATOS, 'peticion.json');
const PREFIJO = '\u0001NJ:';
const CODIGO_REINICIO = 42;
const CODIGO_MEJORA = 43;

let ventana = null;
let activo = null; // proceso cuyo stdin recibe lo que escribe el usuario
let listaParaPintar = false;
const cola = [];
let versionAlArrancar = git(['rev-parse', 'HEAD']).out;

function aLaVentana(msg) {
  if (listaParaPintar && ventana && !ventana.isDestroyed()) ventana.webContents.send('ui', msg);
  else cola.push(msg);
}

/** Conecta la salida JSON de un proceso hijo con la ventana. */
function puentear(proc) {
  const lector = readline.createInterface({ input: proc.stdout });
  lector.on('line', (linea) => {
    if (linea.startsWith(PREFIJO)) {
      try {
        aLaVentana(JSON.parse(linea.slice(PREFIJO.length)));
      } catch {
        /* línea de control mal formada: se ignora */
      }
    }
  });
  proc.stderr.on('data', (d) => process.stderr.write(d));
}

function lanzarMotor() {
  const motor = spawn(NODE, [TSX, join(RAIZ, 'src', 'principal.ts')], {
    cwd: RAIZ,
    env: { ...process.env, NAHUAL_GRAFICA: '1', NAHUAL_PETICION: PETICION, NAHUAL_DATOS: DATOS },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  activo = motor;
  puentear(motor);
  const arranque = Date.now();
  motor.on('exit', (codigo) => {
    if (codigo === CODIGO_MEJORA) {
      mejorarse();
      return;
    }
    if (codigo === CODIGO_REINICIO) {
      aLaVentana({ t: 'evento', e: { tipo: 'info', texto: 'Reiniciando…' } });
      lanzarMotor();
      return;
    }
    if (codigo === 0) {
      app.exit(0);
      return;
    }
    // Arranque fallido tras una mejora: volver a la última versión buena.
    if (Date.now() - arranque < 12000 && git(['rev-parse', 'HEAD']).out !== versionAlArrancar) {
      aLaVentana({ t: 'evento', e: { tipo: 'error', texto: 'La nueva versión no arrancó. Vuelvo a la anterior…' } });
      git(['reset', '--hard', versionAlArrancar]);
      lanzarMotor();
      return;
    }
    app.exit(codigo ?? 1);
  });
}

function mejorarse() {
  let instruccion = '';
  try {
    instruccion = JSON.parse(readFileSync(PETICION, 'utf8')).instruccion ?? '';
    rmSync(PETICION, { force: true });
  } catch {
    /* sin petición válida */
  }
  if (!instruccion) {
    lanzarMotor();
    return;
  }
  aLaVentana({ t: 'evento', e: { tipo: 'estado', modo: 'Mejorándome' } });
  const runner = spawn(NODE, [join(RAIZ, 'nucleo', 'correr-mejora.mjs')], {
    cwd: RAIZ,
    env: { ...process.env, NAHUAL_GRAFICA: '1', NAHUAL_INSTRUCCION: instruccion, NAHUAL_NODE: NODE, NAHUAL_DATOS: DATOS },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  activo = runner;
  puentear(runner);
  runner.on('exit', () => {
    versionAlArrancar = git(['rev-parse', 'HEAD']).out;
    aLaVentana({ t: 'evento', e: { tipo: 'estado', modo: '' } });
    lanzarMotor();
  });
}

function enviarAlActivo(msg) {
  if (activo && activo.stdin.writable) activo.stdin.write(JSON.stringify(msg) + '\n');
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#0f1021',
    title: 'Nahual',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(RAIZ, 'electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  ventana.once('ready-to-show', () => ventana.show());
  ventana.webContents.on('did-finish-load', () => {
    listaParaPintar = true;
    while (cola.length) ventana.webContents.send('ui', cola.shift());
  });
  ventana.loadFile(join(RAIZ, 'electron', 'ui', 'index.html'));
}

ipcMain.on('accion-ui', (_e, msg) => enviarAlActivo(msg));

app.whenReady().then(() => {
  crearVentana();
  lanzarMotor();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => {
  try {
    if (activo && !activo.killed) activo.kill();
  } catch {
    /* ignorar */
  }
  app.exit(0);
});
