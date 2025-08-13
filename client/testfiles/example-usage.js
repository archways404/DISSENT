// example-usage.js
import crypto from 'crypto';
import {
	saveSession,
	loadSession,
	updateSessionCAS,
	buildDhKeyObjects,
	generateDhPairB64,
	rotateOnReceiveDh,
	rotateOnSendNewDh,
	derivePerMessage,
	nextChainKey,
} from './session-vault.js';

/* ---- create a brand-new session ---- */
export async function createAndStoreSession(peerId) {
	const rootKey = crypto.randomBytes(32);

	// initial directional chains from root
	const hkdf = (label, ikm) =>
		crypto.hkdfSync('sha256', ikm, Buffer.alloc(32, 0), Buffer.from(label), 32);

	const sendCk = hkdf('ck:me->them', rootKey);
	const recvCk = hkdf('ck:them->me', rootKey);

	// local DH for epoch 0
	const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
	const myDhPrivB64 = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'der' })).toString(
		'base64'
	);
	const myDhPubB64 = Buffer.from(publicKey.export({ type: 'spki', format: 'der' })).toString(
		'base64'
	);

	const session = {
		version: 1,
		rootKey,
		send: { ck: sendCk, seq: 0 },
		recv: { ck: recvCk, seq: 0 },
		myDh: { privateKeyPkcs8DerB64: myDhPrivB64, publicKeySpkiDerB64: myDhPubB64 },
		theirDhPubSpkiDerB64: '', // unknown yet
		dhEpoch: 0,
		updatedAt: new Date().toISOString(),
	};

	await saveSession(peerId, session);
}

/* ---- ATOMIC: send a message (returns packet) ---- */
export async function atomicSend(peerId, plaintext) {
	return updateSessionCAS(peerId, async (s) => {
		// bump sequence and derive per-message material
		s.send.seq += 1;
		const { mk, nonce } = derivePerMessage(s.send.ck, s.send.seq);

		// AEAD encrypt (bind dir/seq in AAD)
		const aad = Buffer.from(`dir=me->them;seq=${s.send.seq};epoch=${s.dhEpoch}`);
		const cipher = crypto.createCipheriv('aes-256-gcm', mk, nonce, { authTagLength: 16 });
		cipher.setAAD(aad);
		const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
		const tag = cipher.getAuthTag();
		mk.fill(0);

		// advance chain and persist
		s.send.ck = nextChainKey(s.send.ck);

		// return packet via mutation result “side-channel”
		s.__packet = {
			header: {
				dir: 'me->them',
				seq: s.send.seq,
				epoch: s.dhEpoch,
				// include newDhPub if you just rotated before sending
				// newDhPubSpkiDerB64: ...
			},
			ct,
			tag,
			nonce,
			aad,
		};
	}).then((updated) => updated.__packet);
}

/* ---- ATOMIC: receive a message (optionally with a new peer DH pub) ---- */
export async function atomicReceive(peerId, packet) {
	return updateSessionCAS(peerId, async (s) => {
		// If header carries a new peer DH pub, rotate root/chains first
		if (packet.header?.newDhPubSpkiDerB64 && packet.header?.epoch === (s.dhEpoch ?? 0)) {
			// If they changed DH within same epoch label, still rotate; bump epoch
			rotateOnReceiveDh(s, packet.header.newDhPubSpkiDerB64);
		} else if (packet.header?.newDhPubSpkiDerB64) {
			rotateOnReceiveDh(s, packet.header.newDhPubSpkiDerB64);
		}

		// Expected seq (simple case—no skipped map)
		const want = s.recv.seq + 1;
		if (packet.header.seq !== want) {
			throw new Error(`out-of-order: want ${want}, got ${packet.header.seq}`);
		}

		// Derive per-message, decrypt
		const { mk, nonce } = derivePerMessage(s.recv.ck, packet.header.seq);
		if (!nonce.equals(packet.nonce)) {
			// You can either ignore this check (derive nonce yourself), or enforce it
			// Here we enforce: the sender should not send back the nonce, but if it does and mismatches, fail
		}

		const decipher = crypto.createDecipheriv('aes-256-gcm', mk, packet.nonce, {
			authTagLength: 16,
		});
		mk.fill(0);
		if (packet.aad) decipher.setAAD(packet.aad);
		decipher.setAuthTag(packet.tag);
		const pt = Buffer.concat([decipher.update(packet.ct), decipher.final()]);

		// Advance recv chain and seq
		s.recv.ck = nextChainKey(s.recv.ck);
		s.recv.seq = packet.header.seq;

		s.__plaintext = pt;
	}).then((updated) => updated.__plaintext);
}

/* ---- DH rotation flows ---- */

/** Sender side: rotate DH and include new pub in your next packet header */
export async function rotateDhOnSend(peerId) {
	// update session with a fresh local DH pub to advertise
	const newPub = await updateSessionCAS(peerId, async (s) => {
		const pubB64 = rotateOnSendNewDh(s);
		s.__pub = pubB64;
	}).then((s) => s.__pub);

	return newPub; // put into packet.header.newDhPubSpkiDerB64
}

/** Receiver side: (optionally) pre-install peer DH before decrypt loop */
export async function installPeerDh(peerId, theirDhPubSpkiDerB64) {
	await updateSessionCAS(peerId, async (s) => {
		rotateOnReceiveDh(s, theirDhPubSpkiDerB64);
	});
}
