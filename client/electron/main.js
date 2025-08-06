import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';

let cServerProc = null;
const socketPath = '/tmp/protectu84.sock';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Central config path
const configDir = path.join(__dirname, '../config');
const configPath = path.join(configDir, 'cfg.enc');

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

// Import an existing .enc config
ipcMain.handle('import-config', async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog({
		title: 'Select config.enc file',
		filters: [{ name: 'Config Files', extensions: ['enc'] }],
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

		// Example: Generate a random 32-byte identifier
		const identifier = crypto.randomBytes(32).toString('hex');

		// Derive a key from the passphrase
		const salt = crypto.randomBytes(16);
		const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

		// Encrypt the identifier
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
		let encrypted = cipher.update(identifier, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		const authTag = cipher.getAuthTag();

		// File structure: salt|iv|tag|ciphertext (all hex)
		const fileData = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
		fs.writeFileSync(configPath, fileData);

		return true;
	} catch (err) {
		console.error('Failed to create encrypted config:', err);
		return false;
	}
});

ipcMain.handle('unlock-config', async (event, passphrase) => {
	return new Promise((resolve, reject) => {
		const cPath = path.join(__dirname, '../bin/config_reader');
		cServerProc = spawn(cPath, ['--server', configPath]);

		let ready = false;

		cServerProc.stdout.on('data', (data) => {
			const msg = data.toString().trim();
			console.log('[C server]', msg);
			if (msg === 'READY') {
				ready = true;
				resolve('unlocked');
			}
		});

		cServerProc.stderr.on('data', (data) => {
			console.error('[C server stderr]', data.toString());
			if (!ready) reject(data.toString());
		});

		cServerProc.on('close', (code) => {
			console.log(`C server exited with code ${code}`);
		});

		// Send passphrase to C process
		cServerProc.stdin.write(passphrase + '\n');
	});
});

ipcMain.handle('crypto-op', async (event, op, payload) => {
	return new Promise((resolve, reject) => {
		const client = net.createConnection(socketPath, () => {
			client.write(`${op} ${payload}\n`);
		});

		let response = '';
		client.on('data', (data) => {
			response += data.toString();
		});

		client.on('end', () => {
			resolve(response.trim());
		});

		client.on('error', (err) => reject(err));
	});
});

app.on('will-quit', () => {
	if (cServerProc) cServerProc.kill('SIGTERM');
});

app.whenReady().then(createWindow);
