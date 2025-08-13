import crypto from 'crypto';

/* --------- utils --------- */
const toBuf = (x) =>
	x instanceof Buffer
		? x
		: x instanceof Uint8Array
		? Buffer.from(x.buffer, x.byteOffset, x.byteLength)
		: x instanceof ArrayBuffer
		? Buffer.from(x)
		: (() => {
				throw new TypeError('Expect Buffer/Uint8Array/ArrayBuffer');
		  })();

function hkdf(label, ikm, { salt = Buffer.alloc(32, 0), len = 32 } = {}) {
	const out = crypto.hkdfSync('sha256', toBuf(ikm), toBuf(salt), Buffer.from(label), len);
	return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
const hmacSha256 = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const u64be = (n) => {
	const b = Buffer.alloc(8);
	b.writeBigUInt64BE(BigInt(n));
	return b;
};
const hex = (b) => Buffer.from(b).toString('hex');

/* --------- ratchets --------- */
function updateRootKey(root_key, shared_secret, { salt, len = 32 } = {}) {
	const mix = Buffer.concat([toBuf(root_key), toBuf(shared_secret)]);
	const new_root = hkdf('root-update', mix, { salt: salt ?? Buffer.alloc(32, 0), len });
	mix.fill(0);
	return new_root;
}

// directional chains; both sides compute BOTH labels from the same root
const deriveCk_A_to_B = (root_key) => hkdf('ck:A->B', root_key, { len: 32 });
const deriveCk_B_to_A = (root_key) => hkdf('ck:B->A', root_key, { len: 32 });

const nextChainKey = (ck) => hmacSha256(ck, 'step');

function derivePerMessage(chain_key, seq) {
	const seqB = u64be(seq);
	const msg_key = hmacSha256(chain_key, Buffer.concat([Buffer.from('msg'), seqB])); // 32B
	const nonce = hmacSha256(chain_key, Buffer.concat([Buffer.from('nonce'), seqB])) // 32B
		.subarray(0, 12); // 12B for AES-GCM
	return { msg_key, nonce };
}

/* --------- X25519 helpers --------- */
function generateDhKeypair() {
	const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
	return { publicKey, privateKey };
}
function computeSharedSecret(privateKey, theirPublicKey) {
	return crypto.diffieHellman({ privateKey, publicKey: theirPublicKey }); // 32B
}

/* --------- (optional) AES-GCM demo helpers --------- */
function aeadEncrypt(key32, nonce12, plaintext, aad = null) {
	const cipher = crypto.createCipheriv('aes-256-gcm', key32, nonce12, { authTagLength: 16 });
	if (aad) cipher.setAAD(aad);
	const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return { ct, tag };
}
function aeadDecrypt(key32, nonce12, ct, tag, aad = null) {
	const decipher = crypto.createDecipheriv('aes-256-gcm', key32, nonce12, { authTagLength: 16 });
	if (aad) decipher.setAAD(aad);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/* ================= DEMO (A = me, B = peer) ================= */
(function demo() {
	// Shared old root
	let root_key_A = crypto.randomBytes(32);
	let root_key_B = Buffer.from(root_key_A);

	// Ephemeral DH
	const A = generateDhKeypair();
	const B = generateDhKeypair();
	const shared_A = computeSharedSecret(A.privateKey, B.publicKey);
	const shared_B = computeSharedSecret(B.privateKey, A.publicKey);
	if (!shared_A.equals(shared_B)) throw new Error('DH mismatch');

	// Root update (same on both)
	root_key_A = updateRootKey(root_key_A, shared_A);
	root_key_B = updateRootKey(root_key_B, shared_B);
	if (!root_key_A.equals(root_key_B)) throw new Error('root mismatch');

	// Derive BOTH directional chains on BOTH sides
	// A’s view:
	let ck_A_to_B_A = deriveCk_A_to_B(root_key_A); // A SENDS with this
	let ck_B_to_A_A = deriveCk_B_to_A(root_key_A); // A RECEIVES with this (for B->A)
	// B’s view:
	let ck_A_to_B_B = deriveCk_A_to_B(root_key_B); // B RECEIVES on A->B
	let ck_B_to_A_B = deriveCk_B_to_A(root_key_B); // B SENDS on B->A

	// ==== A sends message #1 (A->B) ====
	let seq_A_to_B = 1;
	const { msg_key: A_mk1, nonce: A_n1 } = derivePerMessage(ck_A_to_B_A, seq_A_to_B);
	ck_A_to_B_A = nextChainKey(ck_A_to_B_A);

	const { msg_key: B_mk1, nonce: B_n1 } = derivePerMessage(ck_A_to_B_B, seq_A_to_B);
	ck_A_to_B_B = nextChainKey(ck_A_to_B_B);

	console.log('mk1 match?', A_mk1.equals(B_mk1));
	console.log('n1  match?', A_n1.equals(B_n1));

	const aad = Buffer.from('hdr:A->B:seq=1');
	const { ct: ctAB1, tag: tagAB1 } = aeadEncrypt(A_mk1, A_n1, Buffer.from('hello world'), aad);
	const ptAB1 = aeadDecrypt(B_mk1, B_n1, ctAB1, tagAB1, aad);
	console.log('decrypted ok?', ptAB1.toString() === 'hello world');

	// ==== A sends message #2 (A->B) ====
	seq_A_to_B += 1;
	const { msg_key: A_mk2, nonce: A_n2 } = derivePerMessage(ck_A_to_B_A, seq_A_to_B);
	ck_A_to_B_A = nextChainKey(ck_A_to_B_A);

	const { msg_key: B_mk2, nonce: B_n2 } = derivePerMessage(ck_A_to_B_B, seq_A_to_B);
	ck_A_to_B_B = nextChainKey(ck_A_to_B_B);

	console.log('mk2 match?', A_mk2.equals(B_mk2));
	console.log('n2  match?', A_n2.equals(B_n2));

	console.log('shared         =', hex(shared_A));
	console.log('root_key       =', hex(root_key_A));
	console.log('ck_A->B (A)    =', hex(ck_A_to_B_A)); // after 2 steps
	console.log('ck_A->B (B)    =', hex(ck_A_to_B_B)); // after 2 steps
	console.log('mk1            =', hex(A_mk1));
	console.log('mk2            =', hex(A_mk2));

	/* ===== B sends to A (B->A) ===== */
	let seq_B_to_A = 1;

	// msg #1
	let { msg_key: B_send_mk1, nonce: B_send_n1 } = derivePerMessage(ck_B_to_A_B, seq_B_to_A); // B sends
	ck_B_to_A_B = nextChainKey(ck_B_to_A_B);

	let { msg_key: A_recv_mk1, nonce: A_recv_n1 } = derivePerMessage(ck_B_to_A_A, seq_B_to_A); // A receives
	ck_B_to_A_A = nextChainKey(ck_B_to_A_A);

	console.log(
		'B->A mk1 match?',
		B_send_mk1.equals(A_recv_mk1),
		'nonce match?',
		B_send_n1.equals(A_recv_n1)
	);

	// msg #2
	seq_B_to_A += 1;
	let { msg_key: B_send_mk2, nonce: B_send_n2 } = derivePerMessage(ck_B_to_A_B, seq_B_to_A);
	ck_B_to_A_B = nextChainKey(ck_B_to_A_B);

	let { msg_key: A_recv_mk2, nonce: A_recv_n2 } = derivePerMessage(ck_B_to_A_A, seq_B_to_A);
	ck_B_to_A_A = nextChainKey(ck_B_to_A_A);

	console.log(
		'B->A mk2 match?',
		B_send_mk2.equals(A_recv_mk2),
		'nonce match?',
		B_send_n2.equals(A_recv_n2)
	);

	// (Optional) B->A AEAD demo
	const aadB = Buffer.from('hdr:B->A:seq=2');
	const { ct: ctBA2, tag: tagBA2 } = aeadEncrypt(B_send_mk2, B_send_n2, Buffer.from('ping'), aadB);
	const ptBA2 = aeadDecrypt(A_recv_mk2, A_recv_n2, ctBA2, tagBA2, aadB);
	console.log('B->A decrypt ok?', ptBA2.toString() === 'ping');
})();
