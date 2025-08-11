// main.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Central config path
const configPath = path.join(app.getPath('userData'), 'cfg.json');

let inMemoryPassphrase = null;
let store = null;
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

// Helper: get path to electron-store file without decrypting
function getStorePath() {
	return path.join(app.getPath('userData'), 'cfg.json');
}

function makeStore(key) {
	// Define schema if you like; clearInvalidConfig helps if the file gets corrupted
	return new Store({
		name: 'cfg',
		encryptionKey: key,
		clearInvalidConfig: true,
		schema: {
			settings: {
				type: 'object',
				properties: {
					config_failed_decrypt_count: { type: 'string' },
					config_failed_decrypt_limit: { type: 'string' },
				},
				required: ['config_failed_decrypt_count', 'config_failed_decrypt_limit'],
			},
			conversations: { type: 'object' },
			meta: {
				type: 'object',
				properties: {
					sentinel: { type: 'string' },
				},
			},
		},
	});
}

function scheduleAutoLock(ms = 5 * 60 * 1000) {
	if (autoLockTimer) clearTimeout(autoLockTimer);
	if (inMemoryPassphrase !== null) {
		autoLockTimer = setTimeout(theGreatWall, ms);
		console.log('[MEMORY] Auto-lock timer started/reset.');
	}
}

async function theGreatWall() {
	// wipe references
	if (inMemoryPassphrase) {
		const overwrite = 'x'.repeat(inMemoryPassphrase.length);
		inMemoryPassphrase = overwrite;
	}
	inMemoryPassphrase = null;
	store = null;
	global.gc?.();
	console.log('[MEMORY] Cleared passphrase + store from memory.');

	// Notify renderer(s)
	for (const win of BrowserWindow.getAllWindows()) {
		win.webContents.send('config-locked');
	}
}

// ================= IPC =================

// Check if encrypted config exists (file presence)
ipcMain.handle('check-config', async () => {
	return fs.existsSync(configPath);
});

// Import an existing electron-store file (JSON, but encrypted values inside)
ipcMain.handle('import-config', async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog({
		title: 'Select cfg.json file',
		filters: [{ name: 'Config Files', extensions: ['json'] }],
		properties: ['openFile'],
	});
	if (canceled || filePaths.length === 0) return false;

	try {
		const dest = getStorePath();
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(filePaths[0], dest);
		return true;
	} catch (err) {
		console.error('Failed to import config:', err);
		return false;
	}
});

// Create a brand new encrypted config with a passphrase
ipcMain.handle('create-config-with-pass', async (_evt, passphrase) => {
	try {
		if (!passphrase || passphrase.length < 4) throw new Error('Passphrase too short');

		const s = makeStore(passphrase);

		// write initial content
		s.set('settings', {
			config_failed_decrypt_count: '0',
			config_failed_decrypt_limit: '10',
			config_failed_decrypt_erase: true,
		});
		s.set('conversations', {
			'conversation-uuid': {
				seed: 'abc',
				'random-start-index': '123',
				'random-index-increment': '7',
				'base-delay': '2h',
			},
		});
		// sentinel is used to validate key during "unlock"
		s.set('meta', { sentinel: 'DISSENT-V1' });

		console.log('Encrypted config created at', s.path);

		// (optional) “unlock” immediately
		inMemoryPassphrase = passphrase;
		store = s;
		scheduleAutoLock();

		return true;
	} catch (err) {
		console.error('Failed to create encrypted config:', err);
		return false;
	}
});

// Is it currently unlocked?
ipcMain.handle('config-lock-status', async () => {
	return inMemoryPassphrase !== null && store !== null;
});

// Unlock: try constructing store with passphrase and read sentinel
ipcMain.handle('unlock-config', async (_evt, passphrase) => {
	if (!passphrase || passphrase.length < 4) throw new Error('Passphrase too short');

	try {
		const s = makeStore(passphrase);
		const sentinel = s.get('meta.sentinel');
		if (sentinel !== 'DISSENT-V1') {
			throw new Error('Incorrect passphrase');
		}

		inMemoryPassphrase = passphrase;
		store = s;
		scheduleAutoLock();
		console.log('[MEMORY] Config unlocked and store in memory.');
		return true;
	} catch (err) {
		console.error('[UNLOCK] Failed:', err);
		throw new Error('Incorrect passphrase');
	}
});

// Return decrypted config (whole object) from memory
ipcMain.handle('get-decrypted-config', async () => {
	if (!store) throw new Error('No passphrase in memory.');
	try {
		scheduleAutoLock();
		// store.store returns the full object
		return store.store;
	} catch (err) {
		console.error('Read failed:', err);
		throw err;
	}
});

// Lock now
ipcMain.handle('lock-config', async () => {
	await theGreatWall();
});

// Refresh the inactivity timer (renderer calls on user activity)
ipcMain.handle('refresh-auto-lock', async () => {
	if (inMemoryPassphrase !== null) {
		scheduleAutoLock();
		console.log('[MEMORY] Auto-lock timer refreshed.');
	}
});

app.on('will-quit', async () => {
	await theGreatWall();
});

app.whenReady().then(createWindow);
