// NÚCLEO PROTEGIDO — Nahual no puede modificar este archivo.
// Lo lanza el proceso de Electron cuando el usuario pide una mejora. Ejecuta el guardián
// (que verifica en una copia aislada antes de aplicar) y manda su progreso a la ventana
// como eventos JSON. La aprobación del plan la pide el mejorador a través de la ventana.
import { mejorar } from './guardian.mjs';

const PREFIJO = '\u0001NJ:';
function evento(e) {
  process.stdout.write(PREFIJO + JSON.stringify({ t: 'evento', e }) + '\n');
}

function registrar(linea) {
  const texto = linea.trim();
  if (!texto) return;
  let tipo = 'info';
  if (/^✖/.test(texto)) tipo = 'error';
  else if (/^✔/.test(texto)) tipo = 'exito';
  else if (/^⚠/.test(texto)) tipo = 'aviso';
  evento({ tipo, texto: texto.replace(/^[✖✔⚠ℹ🔧🛡\s]+/u, '').trim() || texto });
}

const instruccion = process.env.NAHUAL_INSTRUCCION || '';
evento({ tipo: 'info', texto: `Voy a mejorarme: «${instruccion}». Trabajo en una copia aislada; la versión que usas no se toca.` });

try {
  const aplicada = await mejorar(instruccion, registrar);
  evento({
    tipo: aplicada ? 'exito' : 'aviso',
    texto: aplicada ? 'Mejora verificada y aplicada. Cargo la nueva versión…' : 'No apliqué ningún cambio; sigo igual que antes.',
  });
  process.exit(aplicada ? 0 : 3);
} catch (e) {
  evento({ tipo: 'error', texto: 'Error durante la mejora: ' + (e?.message ?? String(e)) });
  process.exit(1);
}
