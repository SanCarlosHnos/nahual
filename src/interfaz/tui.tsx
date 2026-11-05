// Interfaz interactiva de terminal (Ink + React).
import { Box, render, Static, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { formatearEvento, formatearPlan } from './formato';
import type { Evento, Interfaz, PasoPlan, SugerenciaComando } from './tipos';

interface Elemento {
  id: number;
  texto: string;
}

type Peticion =
  | { tipo: 'leer'; indicacion?: string; resolver: (texto: string | null) => void }
  | { tipo: 'elegir'; pregunta: string; opciones: string[]; detalle?: string; resolver: (indice: number) => void };

interface EstadoBarra {
  modelo: string;
  carpeta: string;
  contexto: number;
  modo: string;
}

class Almacen {
  elementos: Elemento[] = [];
  plan: PasoPlan[] = [];
  pensando: { etiqueta: string; desde: number } | null = null;
  tokens = 0;
  peticion: Peticion | null = null;
  barra: EstadoBarra = { modelo: '', carpeta: '', contexto: 0, modo: '' };
  private oyentes = new Set<() => void>();
  private version = 0;
  private siguiente = 0;

  suscribir = (oyente: () => void): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };
  obtenerVersion = (): number => this.version;

  cambiar(funcion: (a: Almacen) => void): void {
    funcion(this);
    this.version++;
    for (const o of this.oyentes) o();
  }
  agregar(texto: string): void {
    this.cambiar((a) => (a.elementos = [...a.elementos, { id: a.siguiente++, texto }]));
  }
}

const MARCOS = ['✻', '✶', '✷', '✸', '✹', '✺', '✹', '✸', '✷', '✶'];

function Pensando({ etiqueta, desde, tokens }: { etiqueta: string; desde: number; tokens: number }) {
  const [cuadro, setCuadro] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCuadro((c) => c + 1), 120);
    return () => clearInterval(id);
  }, []);
  const segundos = Math.floor((Date.now() - desde) / 1000);
  return (
    <Box marginTop={1}>
      <Text color="magenta">
        {MARCOS[cuadro % MARCOS.length]} {etiqueta}…
      </Text>
      <Text color="gray">
        {' '}
        ({segundos} s{tokens ? ` · ${tokens} tokens` : ''} · esc para interrumpir)
      </Text>
    </Box>
  );
}

function Entrada({ peticion, sugerencias }: { peticion: Extract<Peticion, { tipo: 'leer' }>; sugerencias: SugerenciaComando[] }) {
  const [valor, setValor] = useState('');
  const [reinicio, setReinicio] = useState(0);
  const coincidencias =
    valor.startsWith('/') && !valor.includes(' ')
      ? sugerencias.filter((s) => ('/' + s.nombre).startsWith(valor.toLowerCase())).slice(0, 6)
      : [];
  useInput((_tecla, k) => {
    if (k.tab && coincidencias[0]) {
      setValor('/' + coincidencias[0].nombre + ' ');
      setReinicio((r) => r + 1);
    }
  });
  return (
    <Box flexDirection="column" marginTop={1}>
      {peticion.indicacion ? <Text color="yellow">{peticion.indicacion}</Text> : null}
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="magenta">{'› '}</Text>
        <TextInput
          key={reinicio}
          value={valor}
          onChange={setValor}
          onSubmit={(texto) => peticion.resolver(texto)}
          placeholder="Escribe lo que necesitas… (/ayuda para ver los comandos)"
        />
      </Box>
      {coincidencias.map((s) => (
        <Text key={s.nombre}>
          <Text color="magenta">{'  /' + s.nombre}</Text>
          <Text color="gray">{'  ' + s.descripcion}</Text>
        </Text>
      ))}
    </Box>
  );
}

function Selector({ peticion }: { peticion: Extract<Peticion, { tipo: 'elegir' }> }) {
  const [indice, setIndice] = useState(0);
  const total = peticion.opciones.length;
  useInput((tecla, k) => {
    if (k.upArrow) setIndice((i) => (i - 1 + total) % total);
    else if (k.downArrow) setIndice((i) => (i + 1) % total);
    else if (k.return) peticion.resolver(indice);
    else if (k.escape) peticion.resolver(total - 1);
    else {
      const numero = Number(tecla);
      if (numero >= 1 && numero <= total) peticion.resolver(numero - 1);
    }
  });
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
      <Text bold>{peticion.pregunta}</Text>
      {peticion.detalle ? <Text color="cyan">{peticion.detalle}</Text> : null}
      <Text> </Text>
      {peticion.opciones.map((opcion, i) => (
        <Text key={i} color={i === indice ? 'yellow' : undefined}>
          {i === indice ? '❯ ' : '  '}
          {i + 1}. {opcion}
        </Text>
      ))}
      <Text color="gray">↑↓ para moverte · enter para elegir · esc para cancelar</Text>
    </Box>
  );
}

function Aplicacion({ almacen, sugerencias, interrumpir }: { almacen: Almacen; sugerencias: SugerenciaComando[]; interrumpir: () => void }) {
  useSyncExternalStore(almacen.suscribir, almacen.obtenerVersion);
  const { elementos, plan, pensando, peticion, barra } = almacen;
  useInput((tecla, k) => {
    const ctrlC = k.ctrl && tecla === 'c';
    if ((k.escape && pensando) || ctrlC) interrumpir();
  });
  const carpeta = barra.carpeta.length > 50 ? '…' + barra.carpeta.slice(-49) : barra.carpeta;
  return (
    <>
      <Static items={elementos}>{(e) => <Text key={e.id}>{e.texto}</Text>}</Static>
      {plan.length > 0 && !plan.every((p) => p.hecho) ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{'  Plan'}</Text>
          <Text>{formatearPlan(plan)}</Text>
        </Box>
      ) : null}
      {pensando ? <Pensando etiqueta={pensando.etiqueta} desde={pensando.desde} tokens={almacen.tokens} /> : null}
      {peticion?.tipo === 'leer' ? <Entrada peticion={peticion} sugerencias={sugerencias} /> : null}
      {peticion?.tipo === 'elegir' ? <Selector peticion={peticion} /> : null}
      <Text color="gray">
        {'  '}
        {barra.modo ? `${barra.modo} · ` : ''}
        {barra.modelo} · {carpeta} · contexto {barra.contexto}%
      </Text>
    </>
  );
}

export function crearInterfazInteractiva(sugerencias: SugerenciaComando[]): Interfaz {
  const almacen = new Almacen();
  let alInterrumpir: () => void = () => {};
  const instancia = render(<Aplicacion almacen={almacen} sugerencias={sugerencias} interrumpir={() => alInterrumpir()} />, {
    exitOnCtrlC: false,
  });

  return {
    emitir(e: Evento) {
      switch (e.tipo) {
        case 'pensando':
          almacen.cambiar((a) => {
            a.pensando = e.activo ? { etiqueta: e.etiqueta ?? 'Pensando', desde: Date.now() } : null;
            a.tokens = 0;
          });
          return;
        case 'progreso':
          almacen.cambiar((a) => (a.tokens = e.tokens));
          return;
        case 'estado':
          almacen.cambiar((a) => {
            a.barra = {
              modelo: e.modelo ?? a.barra.modelo,
              carpeta: e.carpeta ?? a.barra.carpeta,
              contexto: e.contexto ?? a.barra.contexto,
              modo: e.modo ?? a.barra.modo,
            };
          });
          return;
        case 'plan':
          almacen.cambiar((a) => (a.plan = e.fijo ? [] : e.pasos.map((p) => ({ ...p }))));
          if (!e.fijo) return;
          break;
      }
      const texto = formatearEvento(e);
      if (texto !== null) almacen.agregar(texto);
    },
    leer(indicacion) {
      return new Promise((resolver) => {
        almacen.cambiar(
          (a) =>
            (a.peticion = {
              tipo: 'leer',
              indicacion,
              resolver: (texto) => {
                almacen.cambiar((b) => (b.peticion = null));
                if (texto?.trim()) {
                  const evento = formatearEvento({ tipo: 'usuario', texto: texto.trim() });
                  if (evento) almacen.agregar(evento);
                }
                resolver(texto);
              },
            }),
        );
      });
    },
    elegir(pregunta, opciones, detalle) {
      return new Promise((resolver) => {
        almacen.cambiar(
          (a) =>
            (a.peticion = {
              tipo: 'elegir',
              pregunta,
              opciones,
              detalle,
              resolver: (indice) => {
                almacen.cambiar((b) => (b.peticion = null));
                almacen.agregar(formatearEvento({ tipo: 'info', texto: `${pregunta} → ${opciones[indice]}` }) ?? '');
                resolver(indice);
              },
            }),
        );
      });
    },
    alInterrumpir(funcion) {
      alInterrumpir = funcion;
    },
    cerrar() {
      instancia.unmount();
    },
  };
}
