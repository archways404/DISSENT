import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { decryptConfig } from './func/decryptConfig.js';
import { encryptConfig } from './func/encryptConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Central config path
const configDir = path.join(__dirname, '../config');
const configPath = path.join(configDir, 'cfg.json');

let inMemoryPassphrase = null;

let autoLockTimer = null;

function createWindow() {
	const win = new BrowserWindow({
		width: 1000,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	if (process.env.NODE_ENV === 'development') {
		win.loadURL('http://localhost:5173');
	} else {
		win.loadFile(path.join(__dirname, '../dist/index.html'));
	}
}

// Check if config exists
ipcMain.handle('check-config', async () => {
	return fs.existsSync(configPath);
});

// Import an existing config
ipcMain.handle('import-config', async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog({
		title: 'Select config.enc file',
		filters: [{ name: 'Config Files', extensions: ['json'] }],
		properties: ['openFile'],
	});

	if (canceled || filePaths.length === 0) return false;

	try {
		// Ensure config directory exists
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}

		fs.copyFileSync(filePaths[0], configPath);
		return true;
	} catch (err) {
		console.error('Failed to import config:', err);
		return false;
	}
});

ipcMain.handle('create-config-with-pass', async (event, passphrase) => {
	try {
		if (!passphrase || passphrase.length < 4) {
			throw new Error('Passphrase too short');
		}

		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}

		inMemoryPassphrase = passphrase;

		const config = {
			settings: {
				failed_decrypt: '0',
				failed_nuke: '10',
			},
			'conversation-uuid': {
				seed: 'abc',
				'random-start-index': '123',
				'random-index-increment': '7',
				'base-delay': '2h',
			},
		};

		encryptConfig(config, inMemoryPassphrase, configPath);
		console.log('Encrypted and saved.');

		const decrypted = decryptConfig(configPath, inMemoryPassphrase);
		console.log('Decrypted:', decrypted);

		return true;
	} catch (err) {
		console.error('Failed to create encrypted config:', err);
		return false;
	}
});

ipcMain.handle('config-lock-status', async () => {
	return inMemoryPassphrase !== null;
});

ipcMain.handle('unlock-config', async (event, passphrase) => {
	if (!passphrase || passphrase.length < 4) {
		throw new Error('Passphrase too short');
	}

	try {
		// Attempt to decrypt with the given passphrase
		await decryptConfig(configPath, passphrase);

		// If successful, store in memory
		inMemoryPassphrase = passphrase;
		console.log('[MEMORY] Config passphrase stored in memory.');

		return true;
	} catch (err) {
		console.error('[UNLOCK] Failed to unlock config:', err);
		throw new Error('Incorrect passphrase');
	}
});

ipcMain.handle('get-decrypted-config', async () => {
	if (!inMemoryPassphrase) {
		throw new Error('No passphrase in memory.');
	}

	try {
		const config = decryptConfig(configPath, inMemoryPassphrase);
		return config;
	} catch (err) {
		console.error('Decryption failed:', err);
		throw err;
	}
});

ipcMain.handle('lock-config', async () => {
	await theGreatWallLocker();
});

ipcMain.handle('refresh-auto-lock', async () => {
	if (inMemoryPassphrase !== null) {
		scheduleAutoLock(); // default to 5 min or custom
		console.log('[MEMORY] Auto-lock timer refreshed.');
	}
});

function scheduleAutoLock(ms = 1 * 60 * 1000) {
	if (autoLockTimer) clearTimeout(autoLockTimer);

	if (inMemoryPassphrase !== null) {
		autoLockTimer = setTimeout(theGreatWall, ms);
		console.log('[MEMORY] Auto-lock timer started/reset.');
	}
}

async function theGreatWall() {
	if (inMemoryPassphrase) {
		const overwrite = 'x'.repeat(inMemoryPassphrase.length);
		inMemoryPassphrase = overwrite;
	}
	inMemoryPassphrase = null;

	global.gc?.();
	console.log('[MEMORY] Config passphrase cleared from memory.');

	// Notify renderer(s)
	const allWindows = BrowserWindow.getAllWindows();
	for (const win of allWindows) {
		win.webContents.send('config-locked');
	}
}

app.on('will-quit', async () => {
	await theGreatWall();
});

app.whenReady().then(createWindow);
