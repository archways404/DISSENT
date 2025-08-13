// node >= v15 (for hkdfSync)
//const crypto = require('crypto');
import crypto from 'crypto';

/**
 * Generate a cryptographically secure random seed.
 * @param {number} len - bytes of entropy (32 = 256-bit)
 * @returns {Buffer}
 */
function generateSeed(len = 32) {
	return crypto.randomBytes(len);
}

/**
 * Derive root_key and chain_key_0 from a seed using HKDF(SHA-256).
 * Notes:
 * - HKDF requires a salt; use a constant, app-scoped salt for determinism,
 *   or a stored random salt if you want uniqueness per installation.
 * - "info" is a context string to separate keys for different purposes.
 *
 * @param {Buffer} seed
 * @param {Object} [opts]
 * @param {Buffer} [opts.rootSalt]  - 32-byte salt for root HKDF (default: zeros)
 * @param {Buffer} [opts.chainSalt] - 32-byte salt for chain HKDF (default: zeros)
 * @param {number} [opts.keyLen]    - output key length in bytes (default: 32)
 * @returns {{ root_key: Buffer, chain_key_0: Buffer }}
 */
function deriveKeysFromSeed(seed, opts = {}) {
	const keyLen = opts.keyLen ?? 32;

	const rootSalt = opts.rootSalt ?? Buffer.alloc(32, 0); // or app-specific constant
	const chainSalt = opts.chainSalt ?? Buffer.alloc(32, 0);

	// root_key ← HKDF(seed)
	const root_key = crypto.hkdfSync(
		'sha256',
		seed, // ikm
		rootSalt, // salt
		Buffer.from('root-key'), // info
		keyLen
	);

	// chain_key_0 ← HKDF(root_key, info="chain-key:0")
	const chain_key_0 = crypto.hkdfSync(
		'sha256',
		root_key, // ikm
		chainSalt, // salt
		Buffer.from('chain-key:0'), // info
		keyLen
	);

	return { root_key, chain_key_0 };
}

function toHex(x) {
	// x can be Buffer or ArrayBuffer/TypedArray
	if (x instanceof Buffer) return x.toString('hex');
	if (x instanceof ArrayBuffer) return Buffer.from(new Uint8Array(x)).toString('hex');
	if (ArrayBuffer.isView(x))
		return Buffer.from(x.buffer, x.byteOffset, x.byteLength).toString('hex');
	throw new TypeError('Unsupported key type');
}

// --- example usage ---
const seed = generateSeed(); // 32 random bytes
const { root_key, chain_key_0 } = deriveKeysFromSeed(seed);

// If you want hex strings:
console.log('seed        =', seed.toString('hex'));
console.log('root_key    =', root_key.toString('hex'));
console.log('chain_key_0 =', chain_key_0.toString('hex'));

console.log('seed        =', toHex(seed));
console.log('root_key    =', toHex(root_key));
console.log('chain_key_0 =', toHex(chain_key_0));
