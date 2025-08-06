const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	checkConfig: () => ipcRenderer.invoke('check-config'),
	importConfig: () => ipcRenderer.invoke('import-config'),
	createConfigWithPass: (passphrase) => ipcRenderer.invoke('create-config-with-pass', passphrase),
	unlockConfig: (passphrase) => ipcRenderer.invoke('unlock-config', passphrase),
	cryptoOp: (op, payload) => ipcRenderer.invoke('crypto-op', op, payload),
});
