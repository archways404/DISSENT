import {
	createAndStoreSession,
	atomicSend,
	atomicReceive,
	rotateDhOnSend,
	installPeerDh,
} from './example-usage.js';
import { hasSession, listSessions, loadSession } from './session-vault.js';

const peerId = 'testId';

let convExists = await hasSession(peerId);

console.log('convExists? ', convExists); // true/false

if (convExists) {
	console.log('all sessions:', await listSessions()); // ['peer:testId', ...]

	// Inspect what’s stored (parsed from JSON)
	const s = await loadSession(peerId);
	console.log('updatedAt:', s?.updatedAt);
	console.log('send.seq:', s?.send.seq, 'recv.seq:', s?.recv.seq);
} else {
	await createAndStoreSession(peerId);

	// Optionally, rotate DH before sending the next message:
	const newDhPub = await rotateDhOnSend(peerId);

	// Build your header (include newDhPub so the peer rotates on receive)
	const pkt1 = await atomicSend(peerId, Buffer.from('hello A->B'));
	pkt1.header.newDhPubSpkiDerB64 = newDhPub; // attach

	// On the peer device, call:
	// await installPeerDh(peerId, pkt1.header.newDhPubSpkiDerB64);
	// const pt = await atomicReceive(peerId, pkt1);
}
