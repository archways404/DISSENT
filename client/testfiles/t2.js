import crypto from 'crypto';

/* ---------- X25519 DH ---------- */
function generateDhKeypair() {
	const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
	return { publicKey, privateKey };
}

function serializePublicKey(pubKey) {
	const der = pubKey.export({ type: 'spki', format: 'der' });
	return Buffer.from(der).toString('base64');
}

function serializePrivateKey(privKey) {
	const der = privKey.export({ type: 'pkcs8', format: 'der' });
	return Buffer.from(der).toString('base64');
}

function deserializePublicKey(b64) {
	const der = Buffer.from(b64, 'base64');
	return crypto.createPublicKey({ key: der, type: 'spki', format: 'der' });
}

function computeSharedSecret(privateKey, theirPublicKey) {
	return crypto.diffieHellman({ privateKey, publicKey: theirPublicKey }); // Buffer (32 bytes)
}

/* --- tiny byte normalizer --- */
const toBuf = (x) => {
	if (x instanceof Buffer) return x;
	if (x instanceof Uint8Array) return Buffer.from(x.buffer, x.byteOffset, x.byteLength);
	if (x instanceof ArrayBuffer) return Buffer.from(x);
	throw new TypeError('Expect Buffer/Uint8Array/ArrayBuffer');
};

/* HKDF wrapper (SHA‑256) — always return Buffer */
function hkdf(label, ikm, { salt = Buffer.alloc(32, 0), len = 32 } = {}) {
	const out = crypto.hkdfSync('sha256', toBuf(ikm), toBuf(salt), Buffer.from(label), len);
	return Buffer.isBuffer(out) ? out : Buffer.from(out); // <-- normalize
}

/* ---- the update you want ----
 * root_key' ← HKDF( root_key || shared_secret )
 */
function updateRootKey(root_key, shared_secret, { salt, len = 32 } = {}) {
	const mix = Buffer.concat([toBuf(root_key), toBuf(shared_secret)]);
	const new_root = hkdf('root-update', mix, { salt: salt ?? Buffer.alloc(32, 0), len });
	// optional hygiene: zero the concat buffer
	mix.fill(0);
	return new_root; // Buffer(len)
}

// Derive a fresh chain key from a given root key
function deriveChainKeyReset(root_key, { salt = Buffer.alloc(32, 0), len = 32 } = {}) {
	return hkdf('chain-key:reset', root_key, { salt, len }); // Buffer(len)
}

// --- per-message derivations with sequence number (BigEndian) ---
function u64be(n) {
	const b = Buffer.alloc(8);
	b.writeBigUInt64BE(BigInt(n));
	return b;
}

function hmacSha256(key, data) {
	return crypto.createHmac('sha256', key).update(data).digest(); // 32B
}

// chain_{i+1} = HMAC(chain_i, "step")
function nextChainKey(chain_key) {
	return hmacSha256(chain_key, 'step');
}

// Derive per-message key/nonce from current chain key and sequence number
function derivePerMessage(chain_key, seq) {
	const seqBytes = u64be(seq);
	const msg_key = hmacSha256(chain_key, Buffer.concat([Buffer.from('msg'), seqBytes])); // 32B
	const nonce = hmacSha256(chain_key, Buffer.concat([Buffer.from('nonce'), seqBytes])) // 32B
		.subarray(0, 12); // 12B for AES-GCM
	return { msg_key, nonce };
}

function main() {
	const { publicKey, privateKey } = generateDhKeypair();
	console.log('publicKey (b64 DER)            =', serializePublicKey(publicKey));
	console.log('privateKey (b64 DER)           =', serializePrivateKey(privateKey));

	//  correct destructuring with renaming
	const { publicKey: testPublicKey, privateKey: testPrivateKey } = generateDhKeypair();
	console.log('testPublicKey (b64 DER)        =', serializePublicKey(testPublicKey));
	console.log('testPrivateKey (b64 DER)       =', serializePrivateKey(testPrivateKey));

	// Compute shared secret between our private and their (test) public
	const shared_secret = computeSharedSecret(privateKey, testPublicKey);
	console.log('shared_secret                  =', shared_secret.toString('hex'));

	// EXAMPLE OLD ROOT KEY
	const root_key = crypto.randomBytes(32);
	console.log('root_key                       =', root_key.toString('hex'));

	const new_root = updateRootKey(root_key, shared_secret);
	console.log('new_root_key                   =', new_root.toString('hex'));

	const chain_key_reset = deriveChainKeyReset(new_root);

	console.log('chain_key_reset(new root)      =', chain_key_reset.toString('hex'));

	// usage
	let ck = chain_key_reset; // start of a fresh sending chain
	const msgKey1 = deriveMessageKey(ck);
	ck = nextChainKey(ck);
	const msgKey2 = deriveMessageKey(ck);
	const nonce = deriveNonce(ck);

	console.log('msgKey1                        =', msgKey1);
	console.log('msgKey2                        =', msgKey2);
	console.log('nonce                          =', nonce);
}

main();
