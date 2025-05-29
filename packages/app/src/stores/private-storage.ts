import type { StateStorage } from 'zustand/middleware';

const ENCRYPTION_NONCE_KEY = '_skypod-nonce';
const PBKDF2_ITERATIONS = 100000;
const SALT = new TextEncoder().encode('skypod-private-storage-v1');

type DerivedKeys = {
  encryptionKey: CryptoKey,
  hmacKey: CryptoKey
};

let cachedInstallNonce: number[] | undefined;

async function getInstallNonce() {
  if (cachedInstallNonce)
    return cachedInstallNonce;

  const stored = localStorage.getItem(ENCRYPTION_NONCE_KEY);
  if (stored) {
    const binary = atob(stored)
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // cache and return
    cachedInstallNonce = Array.from(bytes)
    return cachedInstallNonce;
  }

  // store
  const values = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...values))
  localStorage.setItem(ENCRYPTION_NONCE_KEY, nonce);

  // cache and return
  cachedInstallNonce = Array.from(values);
  return cachedInstallNonce;
}

async function deriveKeys(): Promise<DerivedKeys> {
  const nonce = await getInstallNonce();

  // Create browser-specific material (stable across sessions)
  const fingerprint = [
    navigator.userAgent,
    location.origin,
    navigator.language
  ].join('|');

  // Combine salt + nonce for key derivation
  const saltWithNonce = new Uint8Array(SALT.length + nonce.length);
  saltWithNonce.set(SALT);
  saltWithNonce.set(nonce, SALT.length);

  // Derive encryption key
  const material      = await crypto.subtle.importKey('raw', new TextEncoder().encode(fingerprint), 'PBKDF2', false, ['deriveKey']);
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltWithNonce,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Derive HMAC key with different salt
  const hmacSaltWithNonce = new Uint8Array(SALT.length + nonce.length + 4);
  hmacSaltWithNonce.set(SALT);
  hmacSaltWithNonce.set(nonce, SALT.length);
  hmacSaltWithNonce.set(new TextEncoder().encode('HMAC'), SALT.length + nonce.length);

  const hmacKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hmacSaltWithNonce,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  return { encryptionKey, hmacKey };
}

async function encrypt(data: string): Promise<string> {
  const { encryptionKey, hmacKey } = await deriveKeys();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encoded
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Generate HMAC of the encrypted data
  const hmacSignature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    combined
  );

  // Combine encrypted data + HMAC signature
  const final = new Uint8Array(combined.length + hmacSignature.byteLength);
  final.set(combined);
  final.set(new Uint8Array(hmacSignature), combined.length);

  return btoa(String.fromCharCode(...final));
}

async function decrypt(encryptedData: string): Promise<string> {
  try {
    const { encryptionKey, hmacKey } = await deriveKeys();
    const final = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Split encrypted data and HMAC (HMAC-SHA256 is 32 bytes)
    const hmacSize = 32;
    if (final.length < hmacSize) {
      throw new Error('Invalid encrypted data: too short for HMAC');
    }

    const combined = final.slice(0, -hmacSize);
    const storedHmac = final.slice(-hmacSize);

    // Verify HMAC
    const isValid = await crypto.subtle.verify(
      'HMAC',
      hmacKey,
      storedHmac,
      combined
    );

    if (!isValid) {
      throw new Error('HMAC verification failed: data may have been tampered with');
    }

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt stored data');
  }
}

export function createPrivateStorage<T extends Record<string, any>>(
  baseStorage: StateStorage,
  privateFields: (keyof T)[]
): StateStorage {
  return {
    async getItem(name: string) {
      const stored = await Promise.resolve(baseStorage.getItem(name));
      if (!stored) return null;

      try {
        const { state, version } = JSON.parse(stored);

        // Decrypt private fields
        for (const field of privateFields) {
          if (state[field] && typeof state[field] === 'string' && state[field].startsWith('enc:')) {
            const encryptedData = state[field].slice(4); // Remove 'enc:' prefix
            state[field] = JSON.parse(await decrypt(encryptedData));
          }
        }

        return JSON.stringify({ state, version });
      } catch (error) {
        console.error('Failed to decrypt stored data:', error);
        // Return null to trigger fresh generation
        return null;
      }
    },

    async setItem(name: string, value: string) {
      try {
        const { state, version } = JSON.parse(value);

        // Encrypt private fields
        for (const field of privateFields) {
          if (state[field] !== undefined) {
            const encrypted = await encrypt(JSON.stringify(state[field]));
            state[field] = `enc:${encrypted}`;
          }
        }

        baseStorage.setItem(name, JSON.stringify({ state, version }));
      } catch (error) {
        console.error('Failed to encrypt data for storage:', error);
        throw error;
      }
    },

    removeItem(name: string) {
      baseStorage.removeItem(name);
    }
  };
}

/**
 * Convenience function for localStorage with encryption
 */
export function createPrivateLocalStorage<T extends Record<string, any>>(
  privateFields: (keyof T)[]
): StateStorage {
  return createPrivateStorage(localStorage, privateFields);
}
