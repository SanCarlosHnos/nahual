// Avatar 3D de Nahual (three.js, incluido localmente en vendor/).
// Es un asistente NO humano: un pequeño robot/espíritu flotante de IA.
// Se anima según el estado del avatar (quieto, trabajando, hablando), que lee de
// #avatar[data-estado]. Si WebGL no está disponible, muestra un respaldo.
// Este archivo es EDITABLE: el propio Nahual puede mejorarlo.
import * as THREE from './vendor/three.module.js';

const contenedor = document.getElementById('avatar');

function respaldo(motivo) {
  contenedor.innerHTML =
    '<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">' +
    '<defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#7b6bff"/><stop offset="100%" stop-color="#2b2170"/></radialGradient></defs>' +
    '<rect x="55" y="70" width="90" height="78" rx="26" fill="url(#g)"/>' +
    '<rect x="66" y="92" width="68" height="30" rx="15" fill="#0c0c1e"/>' +
    '<circle cx="86" cy="107" r="8" fill="#4ad6c8"/><circle cx="114" cy="107" r="8" fill="#4ad6c8"/>' +
    '<rect x="96" y="58" width="8" height="14" rx="4" fill="#7b6bff"/><circle cx="100" cy="54" r="6" fill="#4ad6c8"/></svg>';
  console.warn('Avatar 3D no disponible, usando respaldo:', motivo);
}

let renderizador;
try {
  renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (e) {
  respaldo(e?.message || 'sin WebGL');
}

if (renderizador) {
  iniciar(renderizador);
}

function iniciar(renderizador) {
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camara.position.set(0, 0.2, 7.5);
  camara.lookAt(0, 0.1, 0);

  renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderizador.outputColorSpace = THREE.SRGBColorSpace;
  contenedor.innerHTML = '';
  contenedor.appendChild(renderizador.domElement);
  renderizador.domElement.style.width = '100%';
  renderizador.domElement.style.height = '100%';

  // Luces
  escena.add(new THREE.AmbientLight(0x9aa0ff, 0.8));
  const principal = new THREE.DirectionalLight(0xffffff, 1.6);
  principal.position.set(3, 5, 6);
  escena.add(principal);
  const contorno = new THREE.DirectionalLight(0x4ad6c8, 1.1);
  contorno.position.set(-5, 1, -2);
  escena.add(contorno);

  // Materiales
  const carcasa = new THREE.MeshStandardMaterial({ color: 0x6a4cff, roughness: 0.3, metalness: 0.6 });
  const carcasaClara = new THREE.MeshStandardMaterial({ color: 0x8b7bff, roughness: 0.35, metalness: 0.5 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0c0c1e, roughness: 0.15, metalness: 0.4 });
  const energia = new THREE.MeshStandardMaterial({ color: 0x4ad6c8, emissive: 0x2fd0c0, emissiveIntensity: 1.4, roughness: 0.3 });

  const robot = new THREE.Group();
  escena.add(robot);

  // Núcleo flotante bajo la cabeza (cuerpo de energía)
  const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), energia);
  nucleo.position.y = -1.7;
  robot.add(nucleo);
  const anilloCuerpo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 12, 40), carcasaClara);
  anilloCuerpo.position.y = -1.7;
  anilloCuerpo.rotation.x = Math.PI / 2.4;
  robot.add(anilloCuerpo);

  // Cabeza: cubo redondeado (cápsula) claramente robótica
  const cabeza = new THREE.Group();
  robot.add(cabeza);
  const casco = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.5), carcasa);
  // Redondear un poco escalando una esfera superpuesta
  const cascoTop = new THREE.Mesh(new THREE.SphereGeometry(0.98, 32, 24), carcasa);
  cascoTop.scale.set(0.9, 0.8, 0.82);
  cascoTop.position.y = 0.15;
  cabeza.add(casco, cascoTop);

  // Visor oscuro al frente
  const panelVisor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 0.12), visor);
  panelVisor.position.set(0, 0.05, 0.76);
  cabeza.add(panelVisor);

  // Ojos (luces de energía)
  function ojo(x) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 24), energia);
    o.position.set(x, 0.08, 0.86);
    o.scale.set(1, 1, 0.6);
    cabeza.add(o);
    return o;
  }
  const ojoIzq = ojo(-0.34);
  const ojoDer = ojo(0.34);

  // Barra de "boca" que se ilumina al hablar
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.1), energia);
  boca.position.set(0, -0.32, 0.82);
  cabeza.add(boca);

  // Orejeras / laterales
  for (const lado of [-1, 1]) {
    const oreja = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 20), carcasaClara);
    oreja.rotation.z = Math.PI / 2;
    oreja.position.set(lado * 0.92, 0.05, 0);
    cabeza.add(oreja);
    const luzOreja = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 16), energia);
    luzOreja.rotation.z = Math.PI / 2;
    luzOreja.position.set(lado * 1.02, 0.05, 0);
    cabeza.add(luzOreja);
  }

  // Antena con punta de energía
  const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), carcasaClara);
  antena.position.set(0, 1.05, 0);
  cabeza.add(antena);
  const puntaAntena = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), energia);
  puntaAntena.position.set(0, 1.35, 0);
  cabeza.add(puntaAntena);

  // Anillos orbitales (pensando)
  const orbitas = new THREE.Group();
  orbitas.visible = false;
  cabeza.add(orbitas);
  for (let i = 0; i < 2; i++) {
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(1.35 + i * 0.18, 0.025, 10, 48), energia);
    anillo.rotation.x = Math.PI / 2 + i * 0.5;
    anillo.rotation.y = i * 0.6;
    orbitas.add(anillo);
  }
  const chispas = new THREE.Group();
  orbitas.add(chispas);
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), energia);
    const a = (i / 5) * Math.PI * 2;
    c.position.set(Math.cos(a) * 1.45, Math.sin(a) * 0.3, Math.sin(a) * 1.45);
    chispas.add(c);
  }

  // Estado
  let estado = contenedor.dataset.estado || 'quieto';
  new MutationObserver(() => {
    estado = contenedor.dataset.estado || 'quieto';
  }).observe(contenedor, { attributes: true, attributeFilter: ['data-estado'] });

  function ajustar() {
    const w = contenedor.clientWidth || 240;
    const h = contenedor.clientHeight || 260;
    renderizador.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  ajustar();
  new ResizeObserver(ajustar).observe(contenedor);

  let t = 0;
  let proximoParpadeo = 2 + Math.random() * 3;

  function animar() {
    t += 0.016;
    const trabajando = estado === 'trabajando';
    const hablando = estado === 'hablando';

    // Flotar y girar
    robot.position.y = Math.sin(t * 1.4) * 0.12;
    cabeza.rotation.y = Math.sin(t * 0.6) * (trabajando ? 0.5 : 0.22);
    cabeza.rotation.x = trabajando ? -0.08 + Math.sin(t * 1.5) * 0.05 : Math.sin(t * 0.8) * 0.03;
    nucleo.rotation.y = t * 1.2;
    nucleo.rotation.x = t * 0.8;

    // Parpadeo de los ojos
    let abertura = 1;
    if (t > proximoParpadeo) {
      const f = (t - proximoParpadeo) / 0.13;
      abertura = f < 1 ? 1 - Math.sin(f * Math.PI) : 1;
      if (f >= 1) proximoParpadeo = t + 2 + Math.random() * 3.5;
    }
    ojoIzq.scale.y = ojoDer.scale.y = Math.max(0.08, abertura);

    // Boca al hablar
    const brilloBoca = hablando ? 0.6 + Math.abs(Math.sin(t * 16)) * 1.6 : 0.5;
    boca.material.emissiveIntensity = brilloBoca;
    boca.scale.x = hablando ? 0.7 + Math.abs(Math.sin(t * 16)) * 0.6 : 1;

    // Latido de la punta de la antena y el núcleo
    const latido = 1 + Math.sin(t * (trabajando ? 7 : 3)) * 0.15;
    puntaAntena.scale.setScalar(latido);

    // Pensando: anillos orbitando
    orbitas.visible = trabajando;
    if (trabajando) {
      orbitas.rotation.y = t * 1.8;
      chispas.rotation.z = -t * 2;
    }

    renderizador.render(escena, camara);
    requestAnimationFrame(animar);
  }

  renderizador.domElement.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    respaldo('contexto WebGL perdido');
  });

  animar();
}
