'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Ponte mínima: só a tela de erro usa estas ações.
contextBridge.exposeInMainWorld('atylus', {
  abrirLogs: () => ipcRenderer.invoke('atylus:abrir-logs'),
  tentarNovamente: () => ipcRenderer.invoke('atylus:tentar-novamente'),
  sair: () => ipcRenderer.invoke('atylus:sair'),
});
