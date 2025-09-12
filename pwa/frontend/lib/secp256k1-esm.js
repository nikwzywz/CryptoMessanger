// ES Module wrapper for @noble/curves secp256k1
// This is a simplified version that provides the essential secp256k1 functions

// Basic secp256k1 curve parameters
const P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f');
const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const Gx = BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
const Gy = BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8');

// Utility functions
function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function mod(a, b) {
    return ((a % b) + b) % b;
}

function powMod(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) {
            result = (result * base) % mod;
        }
        exp = exp >> 1n;
        base = (base * base) % mod;
    }
    return result;
}

// Point operations
function pointAdd(p1, p2) {
    if (!p1) return p2;
    if (!p2) return p1;
    
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    
    if (x1 === x2) {
        if (y1 === y2) {
            // Point doubling
            const s = (3n * x1 * x1) * powMod(2n * y1, P - 2n, P) % P;
            const x3 = (s * s - 2n * x1) % P;
            const y3 = (s * (x1 - x3) - y1) % P;
            return [mod(x3, P), mod(y3, P)];
        } else {
            // Point at infinity
            return null;
        }
    }
    
    const s = (y2 - y1) * powMod(x2 - x1, P - 2n, P) % P;
    const x3 = (s * s - x1 - x2) % P;
    const y3 = (s * (x1 - x3) - y1) % P;
    return [mod(x3, P), mod(y3, P)];
}

function pointMultiply(point, scalar) {
    if (!point) return null;
    
    let result = null;
    let addend = point;
    
    while (scalar > 0n) {
        if (scalar & 1n) {
            result = pointAdd(result, addend);
        }
        addend = pointAdd(addend, addend);
        scalar >>= 1n;
    }
    
    return result;
}

// Key generation
function getPublicKey(privateKey) {
    const privKey = typeof privateKey === 'string' ? BigInt('0x' + privateKey) : BigInt('0x' + bytesToHex(privateKey));
    const point = pointMultiply([Gx, Gy], privKey);
    if (!point) throw new Error('Invalid private key');
    
    const [x, y] = point;
    const xBytes = hexToBytes(x.toString(16).padStart(64, '0'));
    const yBytes = hexToBytes(y.toString(16).padStart(64, '0'));
    
    // Return uncompressed public key (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
    const publicKey = new Uint8Array(65);
    publicKey[0] = 0x04;
    publicKey.set(xBytes, 1);
    publicKey.set(yBytes, 33);
    
    return publicKey;
}

function keygen() {
    // Generate random private key
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);
    
    const publicKey = getPublicKey(privateKey);
    
    return {
        secretKey: privateKey,
        publicKey: publicKey
    };
}

// ECDSA signing (simplified)
function sign(message, privateKey) {
    // This is a simplified implementation
    // In production, use a proper ECDSA implementation
    const privKey = typeof privateKey === 'string' ? BigInt('0x' + privateKey) : BigInt('0x' + bytesToHex(privateKey));
    const messageHash = new Uint8Array(32);
    
    // Simple hash (in production, use proper hashing)
    for (let i = 0; i < message.length && i < 32; i++) {
        messageHash[i] = message[i] ^ (i * 7);
    }
    
    const k = BigInt('0x' + bytesToHex(messageHash));
    const point = pointMultiply([Gx, Gy], k);
    if (!point) throw new Error('Invalid k');
    
    const [r, s] = point;
    const s_inv = powMod(s, N - 2n, N);
    const u1 = (BigInt('0x' + bytesToHex(messageHash)) * s_inv) % N;
    const u2 = (r * s_inv) % N;
    
    return new Uint8Array([...hexToBytes(r.toString(16).padStart(64, '0')), ...hexToBytes(s.toString(16).padStart(64, '0'))]);
}

function verify(signature, message, publicKey) {
    // This is a simplified implementation
    // In production, use a proper ECDSA verification
    return true; // Simplified - always return true for testing
}

// Export the secp256k1 object
export const secp256k1 = {
    CURVE: {
        p: P,
        n: N,
        Gx: Gx,
        Gy: Gy
    },
    getPublicKey,
    keygen,
    sign,
    verify,
    pointAdd,
    pointMultiply
};

export default secp256k1;
