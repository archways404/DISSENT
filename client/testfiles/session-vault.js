// session-vault.js
import keytar from 'keytar';
import crypto from 'crypto';

const SERVICE = 'DISSENT/session';

// Is there a session for this peer?
export async function hasSession(peerId) {
	const json = await keytar.getPassword(SERVICE, `peer:${peerId}`);
	return json !== null;
}

// List all peer IDs stored under this service
export async function listSessions() {
	const creds = await keytar.findCredentials(SERVICE); // [{account, password}, ...]
	return creds.map((c) => c.account); // accounts are "peer:<peerId>"
}

/* ---------------- existing (unchanged) ---------------- */
export function serializeSession(s) {
	const b64 = (b) => Buffer.from(b).toString('base64');
	return JSON.stringify({
		version: 1,
		rootKey: b64(s.rootKey),
		send: { ck: b64(s.send.ck), seq: s.send.seq },
		recv: { ck: b64(s.recv.ck), seq: s.recv.seq },
		myDh: {
			privateKeyPkcs8DerB64: s.myDh.privateKeyPkcs8DerB64,
			publicKeySpkiDerB64: s.myDh.publicKeySpkiDerB64,
		},
		theirDhPubSpkiDerB64: s.theirDhPubSpkiDerB64,
		dhEpoch: s.dhEpoch ?? 0,
		updatedAt: s.updatedAt || new Date().toISOString(),
	});
}

export function deserializeSession(jsonStr) {
	const o = JSON.parse(jsonStr);
	const fromB64 = (s) => Buffer.from(s, 'base64');
	return {
		version: o.version,
		rootKey: fromB64(o.rootKey),
		send: { ck: fromB64(o.send.ck), seq: o.send.seq >>> 0 },
		recv: { ck: fromB64(o.recv.ck), seq: o.recv.seq >>> 0 },
		myDh: {
			privateKeyPkcs8DerB64: o.myDh.privateKeyPkcs8DerB64,
			publicKeySpkiDerB64: o.myDh.publicKeySpkiDerB64,
		},
		theirDhPubSpkiDerB64: o.theirDhPubSpkiDerB64,
		dhEpoch: o.dhEpoch ?? 0,
		updatedAt: o.updatedAt,
	};
}

export function buildDhKeyObjects(myDh, theirDhPubSpkiDerB64) {
	const myPrivateKey = crypto.createPrivateKey({
		key: Buffer.from(myDh.privateKeyPkcs8DerB64, 'base64'),
		format: 'der',
		type: 'pkcs8',
	});
	const myPublicKey = crypto.createPublicKey({
		key: Buffer.from(myDh.publicKeySpkiDerB64, 'base64'),
		format: 'der',
		type: 'spki',
	});
	const theirPublicKey = theirDhPubSpkiDerB64
		? crypto.createPublicKey({
				key: Buffer.from(theirDhPubSpkiDerB64, 'base64'),
				format: 'der',
				type: 'spki',
		  })
		: null;
	return { myPrivateKey, myPublicKey, theirPublicKey };
}

export async function saveSession(peerId, sessionObj) {
	const json = serializeSession(sessionObj);
	await keytar.setPassword(SERVICE, `peer:${peerId}`, json);
}

export async function loadSession(peerId) {
	const json = await keytar.getPassword(SERVICE, `peer:${peerId}`);
	return json ? deserializeSession(json) : null;
}

export async function deleteSession(peerId) {
	await keytar.deletePassword(SERVICE, `peer:${peerId}`);
}

/* ---------------- new: tiny HKDF/HMAC utils ---------------- */
const hkdf = (label, ikm, len = 32) =>
	crypto.hkdfSync('sha256', ikm, Buffer.alloc(32, 0), Buffer.from(label), len);
const hmac256 = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

/* ---------------- new: CAS-style atomic updater ---------------- */
/**
 * Atomically update a session with optimistic concurrency.
 * - Loads, passes to `mutator`, stamps updatedAt, and saves
 * - If the keychain changed in the meantime, retries up to `retries`
 */
export async function updateSessionCAS(peerId, mutator, { retries = 5 } = {}) {
	for (let i = 0; i < retries; i++) {
		const before = await loadSession(peerId);
		if (!before) throw new Error(`No session for ${peerId}`);

		const originalUpdatedAt = before.updatedAt;

		// Let caller mutate a copy
		const draft = structuredClone ? structuredClone(before) : JSON.parse(JSON.stringify(before));
		await mutator(draft);

		draft.updatedAt = new Date().toISOString();

		// CAS check: reload and compare updatedAt
		const check = await loadSession(peerId);
		if (!check || check.updatedAt !== originalUpdatedAt) {
			// someone else wrote meanwhile — retry
			continue;
		}
		await saveSession(peerId, draft);
		return draft;
	}
	throw new Error('Concurrent update conflict: too many retries');
}

/* ---------------- new: DH ratchet helpers ---------------- */
/** Generate a fresh X25519 keypair, export as base64 DER strings */
export function generateDhPairB64() {
	const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
	return {
		privB64: Buffer.from(privateKey.export({ type: 'pkcs8', format: 'der' })).toString('base64'),
		pubB64: Buffer.from(publicKey.export({ type: 'spki', format: 'der' })).toString('base64'),
	};
}

/** Install a new peer DH public key, update root + rederive both chains, reset seq, bump epoch */
export function rotateOnReceiveDh(session, theirDhPubSpkiDerB64) {
	// build key objects
	const { myPrivateKey } = buildDhKeyObjects(session.myDh, theirDhPubSpkiDerB64);
	const theirPublicKey = crypto.createPublicKey({
		key: Buffer.from(theirDhPubSpkiDerB64, 'base64'),
		type: 'spki',
		format: 'der',
	});

	// DH → shared
	const shared = crypto.diffieHellman({ privateKey: myPrivateKey, publicKey: theirPublicKey });

	// Root update
	const mix = Buffer.concat([session.rootKey, shared]);
	const newRoot = hkdf('root-update', mix, 32);
	mix.fill(0);

	// Re-derive directional chains; reset counters
	session.rootKey = newRoot;
	session.send = { ck: hkdf('ck:me->them', newRoot, 32), seq: 0 };
	session.recv = { ck: hkdf('ck:them->me', newRoot, 32), seq: 0 };
	session.theirDhPubSpkiDerB64 = theirDhPubSpkiDerB64;
	session.dhEpoch = (session.dhEpoch ?? 0) + 1;
}

/** Prepare to send with a new local DH pub (you’ll include it in your header) */
export function rotateOnSendNewDh(session) {
	const { privB64, pubB64 } = generateDhPairB64();
	session.myDh.privateKeyPkcs8DerB64 = privB64;
	session.myDh.publicKeySpkiDerB64 = pubB64;
	// Note: root isn’t updated here. The peer will run rotateOnReceiveDh when it sees pubB64.
	return pubB64; // send this to the peer in the next message header
}

/* ---------------- new: per-message helpers (send/recv) ---------------- */
const u64be = (n) => {
	const b = Buffer.alloc(8);
	b.writeBigUInt64BE(BigInt(n));
	return b;
};

export function derivePerMessage(ck, seq) {
	const seqB = u64be(seq);
	const mk = hmac256(ck, Buffer.concat([Buffer.from('msg'), seqB])); // 32B
	const nonce = hmac256(ck, Buffer.concat([Buffer.from('nonce'), seqB])) // 32B
		.subarray(0, 12); // 12B for GCM
	return { mk, nonce };
}

export function nextChainKey(ck) {
	return hmac256(ck, 'step');
}
