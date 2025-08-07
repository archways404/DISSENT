import fs from 'fs';
import crypto from 'crypto';

export function encryptConfig(configObject, passphrase, outputPath) {
	const salt = crypto.randomBytes(16);
	const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');
	const iv = crypto.randomBytes(16);

	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const plaintext = JSON.stringify(configObject);
	console.log('plaintext', plaintext);
	let encrypted = cipher.update(plaintext, 'utf8');
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	const tag = cipher.getAuthTag();

	// Combine salt + iv + tag + ciphertext into one buffer and base64 it
	const combined = Buffer.concat([salt, iv, tag, encrypted]);
	const base64Encoded = combined.toString('base64');

	fs.writeFileSync(outputPath, base64Encoded);
}
