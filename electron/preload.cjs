const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  print: (opts) => ipcRenderer.invoke('printers:print', opts),
});
