const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	checkConfig: () => ipcRenderer.invoke('check-config'),
	importConfig: () => ipcRenderer.invoke('import-config'),
	createConfigWithPass: (passphrase) => ipcRenderer.invoke('create-config-with-pass', passphrase),
	unlockConfig: (passphrase) => ipcRenderer.invoke('unlock-config', passphrase),
	getDecryptedConfig: () => ipcRenderer.invoke('get-decrypted-config'),
	lockConfig: () => ipcRenderer.invoke('lock-config'),
	configLockStatus: () => ipcRenderer.invoke('config-lock-status'),
	refreshAutoLock: () => ipcRenderer.invoke('refresh-auto-lock'),
	onConfigLocked: (callback) => ipcRenderer.on('config-locked', callback),
	removeConfigLocked: (callback) => ipcRenderer.removeListener('config-locked', callback),
});

