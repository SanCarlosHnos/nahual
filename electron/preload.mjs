// PRECARGA DE ELECTRON — archivo protegido: Nahual no puede modificarlo.
// Expone a la ventana un puente mínimo y seguro, sin acceso directo a Node.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('nahual', {
  // Recibe mensajes del motor (eventos, peticiones de lectura o de elección).
  alMensaje: (callback) => ipcRenderer.on('ui', (_evento, mensaje) => callback(mensaje)),
  // Envía al motor la respuesta del usuario o una interrupción.
  enviar: (mensaje) => ipcRenderer.send('accion-ui', mensaje),
});
