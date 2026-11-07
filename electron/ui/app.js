// Lógica de la ventana de Nahual. Recibe mensajes del motor por window.nahual y pinta la
// conversación, el avatar y las peticiones de entrada o de elección.
// Este archivo NO está protegido: el propio Nahual puede mejorarlo más adelante.

const mensajes = document.getElementById('mensajes');
const entrada = document.getElementById('entrada');
const barraEntrada = document.getElementById('barra-entrada');
const cajaEleccion = document.getElementById('eleccion');
const avatar = document.getElementById('avatar');
const estadoAvatar = document.getElementById('estado-avatar');

let idLecturaPendiente = null; // id del «leer» que espera respuesta
let planActual = null; // elemento del plan en curso, para actualizarlo en vez de duplicar
let elementoPensando = null;
let temporizadorHablar = null;

// ---------- utilidades ----------
function alFinal() {
  mensajes.scrollTop = mensajes.scrollHeight;
}

function crear(clase, padre = mensajes) {
  const div = document.createElement('div');
  if (clase) div.className = clase;
  padre.appendChild(div);
  return div;
}

// Escapa HTML y aplica un markdown mínimo seguro (negritas y `código`).
function formato(texto) {
  const escapado = texto.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  return escapado
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function fijarAvatar(estado) {
  avatar.dataset.estado = estado;
}

function hablarUnMomento() {
  fijarAvatar('hablando');
  clearTimeout(temporizadorHablar);
  temporizadorHablar = setTimeout(() => {
    if (avatar.dataset.estado === 'hablando') fijarAvatar('quieto');
  }, 1800);
}

function quitarPensando() {
  if (elementoPensando) {
    elementoPensando.remove();
    elementoPensando = null;
  }
}

// ---------- pintar cada tipo de evento ----------
function pintarEvento(e) {
  switch (e.tipo) {
    case 'bienvenida': {
      const b = crear('bienvenida');
      const consejos = (e.consejos || []).map((c) => `<li>${formato(c)}</li>`).join('');
      b.innerHTML =
        `<h1>✦ ${formato(e.titulo)}</h1>` +
        `<div class="sub">versión ${formato(e.version)} · modelo ${formato(e.modelo)}</div>` +
        `<ul>${consejos}</ul>`;
      estadoAvatar.textContent = 'en línea';
      break;
    }
    case 'usuario': {
      const f = crear('fila user');
      crear('burbuja', f).innerHTML = formato(e.texto);
      break;
    }
    case 'asistente': {
      quitarPensando();
      const f = crear('fila ia');
      crear('burbuja', f).innerHTML = formato(e.texto);
      hablarUnMomento();
      break;
    }
    case 'accion': {
      quitarPensando();
      const a = crear('accion');
      a.innerHTML = `<span class="punto">●</span> <span><strong>${formato(e.nombre)}</strong> <span class="detalle">${formato(e.detalle || '')}</span></span>`;
      break;
    }
    case 'resultado': {
      const r = crear('resultado' + (e.ok ? '' : ' error'));
      let html = formato(e.resumen || '');
      for (const d of e.diferencias || []) {
        const clase = d.signo === '+' ? 'dif-mas' : 'dif-menos';
        html += `\n<span class="${clase}">${d.signo} ${formato(d.texto)}</span>`;
      }
      r.innerHTML = html;
      break;
    }
    case 'plan': {
      if (e.fijo && planActual) {
        pintarPasos(planActual, e.pasos);
        planActual = null;
        break;
      }
      if (!planActual || !planActual.isConnected) planActual = crear('plan');
      planActual.dataset.vivo = e.fijo ? '' : '1';
      pintarPasos(planActual, e.pasos);
      if (e.fijo) planActual = null;
      break;
    }
    case 'pensando': {
      if (e.activo) {
        fijarAvatar('trabajando');
        if (!elementoPensando) {
          elementoPensando = crear('');
          elementoPensando.id = 'pensando';
          elementoPensando.innerHTML = `<span class="puntos"><span></span><span></span><span></span></span> <span class="txt">${formato(e.etiqueta || 'Pensando')}…</span>`;
        }
      } else {
        quitarPensando();
        if (avatar.dataset.estado === 'trabajando') fijarAvatar('quieto');
      }
      break;
    }
    case 'progreso': {
      if (elementoPensando) {
        const t = elementoPensando.querySelector('.txt');
        if (t) t.textContent = `Trabajando… ${e.tokens} tokens`;
      }
      break;
    }
    case 'estado': {
      if (e.modelo !== undefined) document.getElementById('e-modelo').textContent = 'modelo: ' + e.modelo;
      if (e.carpeta !== undefined) document.getElementById('e-carpeta').textContent = 'carpeta: ' + e.carpeta;
      if (e.contexto !== undefined) document.getElementById('e-contexto').textContent = 'memoria: ' + e.contexto + '%';
      if (e.modo !== undefined) {
        document.getElementById('e-modo').textContent = e.modo ? '● ' + e.modo : '';
        estadoAvatar.textContent = e.modo || 'en línea';
      }
      break;
    }
    case 'info':
    case 'exito':
    case 'aviso':
    case 'error': {
      quitarPensando();
      crear('sistema ' + e.tipo).innerHTML = formato(e.texto);
      if (e.tipo === 'error') fijarAvatar('quieto');
      break;
    }
    case 'bloque': {
      const b = crear('bloque');
      const lineas = (e.lineas || []).map((l) => `<div class="linea">${formato(l)}</div>`).join('');
      b.innerHTML = `<h3>${formato(e.titulo)}</h3>${lineas}`;
      break;
    }
  }
  alFinal();
}

function pintarPasos(contenedor, pasos) {
  const filas = pasos
    .map((p) => `<div class="paso ${p.hecho ? 'hecho' : ''}"><span class="marca">${p.hecho ? '✔' : '○'}</span> ${formato(p.texto)}</div>`)
    .join('');
  contenedor.innerHTML = `<h3>Plan</h3>${filas}`;
}

// ---------- entrada del usuario ----------
function habilitarEntrada(indicacion) {
  entrada.disabled = false;
  entrada.placeholder = indicacion ? indicacion + '…' : 'Escribe lo que necesitas…  (Enter para enviar · Shift+Enter nueva línea)';
  entrada.focus();
}

function pedirEleccion(e) {
  cajaEleccion.innerHTML = '';
  cajaEleccion.classList.remove('oculto');
  const p = crear('pregunta', cajaEleccion);
  p.textContent = e.pregunta;
  if (e.detalle) crear('detalle', cajaEleccion).textContent = e.detalle;
  const cont = crear('opciones', cajaEleccion);
  e.opciones.forEach((opcion, i) => {
    const boton = document.createElement('button');
    boton.textContent = opcion;
    if (i > 0) boton.className = 'secundario';
    boton.onclick = () => {
      cajaEleccion.classList.add('oculto');
      cajaEleccion.innerHTML = '';
      window.nahual.enviar({ t: 'respuesta', id: e.id, valor: i });
      pintarEvento({ tipo: 'info', texto: `${e.pregunta} → ${opcion}` });
    };
    cont.appendChild(boton);
  });
  alFinal();
}

function enviarEntrada() {
  if (entrada.disabled || idLecturaPendiente === null) return;
  const texto = entrada.value.trim();
  if (!texto) return;
  const id = idLecturaPendiente;
  idLecturaPendiente = null;
  entrada.value = '';
  entrada.style.height = 'auto';
  entrada.disabled = true;
  window.nahual.enviar({ t: 'respuesta', id, valor: texto });
}

barraEntrada.addEventListener('submit', (ev) => {
  ev.preventDefault();
  enviarEntrada();
});

entrada.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    enviarEntrada();
  } else if (ev.key === 'Escape') {
    window.nahual.enviar({ t: 'interrumpir' });
  }
});

entrada.addEventListener('input', () => {
  entrada.style.height = 'auto';
  entrada.style.height = Math.min(entrada.scrollHeight, 160) + 'px';
});

// ---------- recibir mensajes del motor ----------
window.nahual.alMensaje((msg) => {
  if (msg.t === 'evento') {
    pintarEvento(msg.e);
  } else if (msg.t === 'leer') {
    idLecturaPendiente = msg.id;
    habilitarEntrada(msg.indicacion);
    if (avatar.dataset.estado !== 'hablando') fijarAvatar('quieto');
  } else if (msg.t === 'elegir') {
    pedirEleccion(msg);
  }
});

fijarAvatar('quieto');
