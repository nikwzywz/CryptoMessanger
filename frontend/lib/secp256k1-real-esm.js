// ES Module wrapper for @noble/curves/secp256k1
// This file provides a proper ES module export for the CommonJS secp256k1 library

// Import the CommonJS module
import secp256k1Module from './secp256k1-real.js';

// Export the secp256k1 object as a named export
export const secp256k1 = secp256k1Module.secp256k1 || secp256k1Module.default || secp256k1Module;

// Also export other functions if needed
export const hashToCurve = secp256k1Module.hashToCurve;
export const encodeToCurve = secp256k1Module.encodeToCurve;
export const schnorr = secp256k1Module.schnorr;
