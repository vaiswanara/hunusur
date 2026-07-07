/**
 * Vamsha Client-Side Cryptography Helper
 * Uses standard Web Crypto API (AES-GCM) for password-based encryption and decryption.
 * Zero external library dependencies.
 */

const ITERATIONS = 100000;
const HASH_ALGO = 'SHA-256';

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string (plaintext) using a password.
 * Outputs a Base64-encoded combined payload: salt (16 bytes) + IV (12 bytes) + ciphertext.
 * @param {string} plaintext
 * @param {string} password
 * @returns {Promise<string>} Base64 combined payload
 */
export async function encryptData(plaintext, password) {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine salt, IV, and ciphertext into one Uint8Array
  const combined = new Uint8Array(salt.length + iv.length + ciphertextBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertextBuffer), salt.length + iv.length);

  // Convert binary array to base64 string
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a Base64-encoded payload using a password.
 * @param {string} base64Payload
 * @param {string} password
 * @returns {Promise<string>} decrypted plaintext
 */
export async function decryptData(base64Payload, password) {
  try {
    const binaryString = atob(base64Payload);
    const len = binaryString.length;
    const combined = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    if (combined.length < 28) {
      throw new Error('Invalid payload size');
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const key = await deriveKey(password, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (e) {
    throw new Error('Incorrect password or corrupted database payload');
  }
}
