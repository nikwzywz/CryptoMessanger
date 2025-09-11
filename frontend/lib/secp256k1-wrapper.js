// ES Module wrapper for @noble/curves/secp256k1
// This creates a simple ES module that can be imported

// We'll create a minimal secp256k1 implementation for testing
// In a real scenario, you would use a proper ES module build

console.log('📦 Версия secp256k1-wrapper.js: v2.1 - 2025-01-11 19:50 (добавлен utils)');

export const secp256k1 = {
    CURVE: {
        n: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
        p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,
        a: 0n,
        b: 7n,
        Gx: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
        Gy: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
        h: 1n,
        nBitLength: 256,
        Fp: null, // Will be set dynamically
        hEff: 1n
    },
    
    getPublicKey: (privateKey, isCompressed = true) => {
        // This is a mock implementation for testing
        // In a real scenario, you would use the actual secp256k1 implementation
        console.log('Mock getPublicKey called with:', privateKey);
        
        // Return a mock public key (65 bytes for uncompressed, 33 for compressed)
        const mockPublicKey = new Uint8Array(isCompressed ? 33 : 65);
        mockPublicKey[0] = isCompressed ? 0x02 : 0x04; // Compressed/uncompressed prefix
        return mockPublicKey;
    },
    
    keygen: () => {
        console.log('Mock keygen called');
        const privateKey = new Uint8Array(32);
        crypto.getRandomValues(privateKey);
        const publicKey = secp256k1.getPublicKey(privateKey);
        return { secretKey: privateKey, publicKey };
    },
    
    sign: (message, privateKey) => {
        console.log('Mock sign called');
        // Return a mock signature (64 bytes)
        const signature = new Uint8Array(64);
        crypto.getRandomValues(signature);
        return signature;
    },
    
    verify: (signature, message, publicKey) => {
        console.log('Mock verify called');
        // Always return true for mock
        return true;
    },
    
    pointAdd: (a, b) => {
        console.log('Mock pointAdd called');
        return new Uint8Array(65);
    },
    
    pointMultiply: (point, scalar) => {
        console.log('Mock pointMultiply called');
        return new Uint8Array(65);
    },
    
    utils: {
        randomPrivateKey: () => {
            console.log('Mock randomPrivateKey called');
            const privateKey = new Uint8Array(32);
            crypto.getRandomValues(privateKey);
            return privateKey;
        },
        randomBytes: (length) => {
            console.log('Mock randomBytes called');
            const bytes = new Uint8Array(length);
            crypto.getRandomValues(bytes);
            return bytes;
        }
    }
};

// Export other functions as well
export const hashToCurve = () => {
    console.log('Mock hashToCurve called');
    return new Uint8Array(65);
};

export const encodeToCurve = () => {
    console.log('Mock encodeToCurve called');
    return new Uint8Array(65);
};

export const schnorr = {
    sign: () => {
        console.log('Mock schnorr.sign called');
        return new Uint8Array(64);
    },
    verify: () => {
        console.log('Mock schnorr.verify called');
        return true;
    }
};
