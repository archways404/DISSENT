import fs from 'fs';
import crypto from 'crypto';

export function decryptConfig(inputPath, passphrase) {
	const fileContent = fs.readFileSync(inputPath, 'utf8');
	const buffer = Buffer.from(fileContent, 'base64');

	const salt = buffer.slice(0, 16);
	const iv = buffer.slice(16, 32);
	const tag = buffer.slice(32, 48);
	const ciphertext = buffer.slice(48);

	const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');

	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);

	let decrypted = decipher.update(ciphertext);
	decrypted = Buffer.concat([decrypted, decipher.final()]);

	return JSON.parse(decrypted.toString('utf8'));
}
