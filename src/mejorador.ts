// Trabajador de mejoras. Lo lanza el guardián (nucleo/guardian.mjs) con:
//   NAHUAL_STAGING     → carpeta del taller (copia aislada) que se puede modificar
//   NAHUAL_INSTRUCCION → la mejora pedida por el usuario
// Fase 1: explora y propone un plan (el usuario lo aprueba). Fase 2: implementa y se autoverifica.
// Solo edita la copia del taller. Códigos de salida: 0 = verificado, 1 = fallo, 3 = sin cambios o cancelado.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Agente } from './agente';
import { cargarConfig } from './config';
import { cargarEquipo, resumenEquipo } from './equipo';
import { recortar } from './herramientas';
import { crearInterfaz } from './interfaz/index';
import type { Interfaz } from './interfaz/tipos';
import { indicacionesDeMejora } from './indicaciones';
import { leerMemoria } from './memoria';
import { leerCapacidadesCreativas } from './capacidades';
import { PROTEGIDOS, RAIZ } from './rutas';

function verificar(dir: string, ui: Interfaz): { ok: boolean; informe: string } {
  ui.emitir({ tipo: 'info', texto: 'Verificando la copia del taller…' });
  const r = spawnSync(process.execPath, [join(RAIZ, 'nucleo', 'verificar.mjs'), dir], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const informe = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  return { ok: r.status === 0, informe: recortar(informe, 6000) };
}

async function main(): Promise<number> {
  if (process.argv.includes('--check')) {
    indicacionesDeMejora(RAIZ);
    console.log('check ok');
    return 0;
  }

  const taller = process.env.NAHUAL_STAGING;
  const instruccion = process.env.NAHUAL_INSTRUCCION;
  if (!taller || !instruccion || !existsSync(taller)) {
    console.error('El mejorador solo lo puede lanzar el guardián.');
    return 1;
  }

  const cfg = cargarConfig();
  const ui = await crearInterfaz([]);
  const contexto = { equipo: resumenEquipo(cargarEquipo()), memoria: leerMemoria(), creativas: leerCapacidadesCreativas() };

  const ctxHerramientas = {
    raiz: resolve(taller),
    protegidos: PROTEGIDOS,
    ui,
    autoAprobar: false,
    permitirSiempre: false,
    soloLectura: true, // fase de planeación
    cambiados: new Set<string>(),
    requiereTerminar: true,
    equipo: () => cargarEquipo(),
  };
  const agente = new Agente(cfg, indicacionesDeMejora(taller, contexto), ctxHerramientas, 'mejora');

  try {
    // FASE 1: plan
    ui.emitir({ tipo: 'info', texto: `Mejora pedida: «${instruccion}». Primero preparo un plan.` });
    await agente.ejecutar(
      `El usuario pidió esta mejora:\n${instruccion}\n\nExplora los archivos necesarios y presenta tu plan con la acción plan. Todavía no modifiques nada.`,
      { pararEnPlan: true },
    );

    if (agente.plan.length === 0) {
      ui.emitir({ tipo: 'aviso', texto: 'No logré armar un plan claro. Cancelo la mejora.' });
      return 3;
    }

    // NAHUAL_APROBAR_PLAN=1 aprueba el plan sin preguntar; solo lo usan las pruebas automatizadas.
    // El supervisor real nunca lo activa, así que en el uso normal siempre decides tú.
    const aprobacionAutomatica = process.env.NAHUAL_APROBAR_PLAN === '1';
    const eleccion = aprobacionAutomatica
      ? 0
      : await ui.elegir('¿Apruebo este plan y lo implemento?', ['Sí, adelante', 'No, cancelar'], agente.plan.map((p, i) => `${i + 1}. ${p.texto}`).join('\n'));
    if (eleccion !== 0) {
      ui.emitir({ tipo: 'info', texto: 'Mejora cancelada. No cambié nada.' });
      return 3;
    }

    // FASE 2: implementación (ya se permite escribir y ejecutar)
    ctxHerramientas.soloLectura = false;
    let resultado = await agente.ejecutar('Plan aprobado. Impleméntalo paso por paso, marca cada paso con hecho y termina con terminar.');

    if (agente.ctx.cambiados.size === 0) {
      ui.emitir({ tipo: 'aviso', texto: 'No modifiqué ningún archivo.' });
      return 3;
    }

    // Verificación con intentos de corrección
    let revision = verificar(taller, ui);
    for (let intento = 1; !revision.ok && intento <= cfg.maxCorrecciones; intento++) {
      ui.emitir({ tipo: 'aviso', texto: `La verificación falló (corrección ${intento}/${cfg.maxCorrecciones}).` });
      // Limpiar el contexto de correcciones anteriores para evitar que el historial acumulado degrade la calidad
      agente.limpiarContextoCorrecciones();
      resultado = await agente.ejecutar(`La verificación automática FALLÓ. Corrige el problema y vuelve a usar terminar.\n\n${revision.informe}`);
      revision = verificar(taller, ui);
    }

    if (!revision.ok) {
      ui.emitir({ tipo: 'error', texto: 'No logré una versión que pase la verificación.' });
      return 1;
    }
    ui.emitir({ tipo: 'exito', texto: 'La copia del taller pasó la verificación.' });
    // El resumen ya lo mostró el agente al terminar: repetirlo aquí llenaba la pantalla de duplicados.
    if (!resultado.terminado && resultado.resumen) ui.emitir({ tipo: 'aviso', texto: resultado.resumen });
    return 0;
  } finally {
    ui.cerrar();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
