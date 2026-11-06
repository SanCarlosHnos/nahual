import { app } from 'electron';
app.whenReady().then(() => { console.log('ELECTRON_OK'); app.exit(7); });
app.on('window-all-closed', () => app.exit(7));
