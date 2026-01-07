"use client";

import { EncryptedCanopyKeyfile } from "@/types/wallet";
/**
 * Wallet generation and encryption module
 *
 * Provides ED25519 key pair generation and AES-GCM encryption
 * for Canopy Launchpad wallets.
 *
 * Security features:
 * - ED25519 cryptography (fast, secure, industry standard)
 * - Argon2id key derivation (memory-hard, GPU-resistant)
 * - AES-256-GCM authenticated encryption
 * - Random salt per wallet (prevents rainbow table attacks)
 */

import { argon2i } from "@noble/hashes/argon2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

/**
 * Argon2id parameters for key derivation
 * - time: 3 iterations
 * - memory: 32 MB (32 * 1024 KB)
 * - parallelism: 4 threads
 */
const ARGON2_PARAMS = {
  t: 3, // time cost (iterations)
  m: 32 * 1024, // memory cost in KB (32 MB)
  p: 4, // parallelism (threads)
};

const SALT_LENGTH = 16; // 16 bytes (128 bits)
const NONCE_LENGTH = 12; // 12 bytes (96 bits) for AES-GCM

/**
 * Derives an AES-256 key from a password and salt using Argon2id
 * Returns 32-byte key suitable for AES-256-GCM encryption
 */
function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  const passwordBytes = new TextEncoder().encode(password);

  // Argon2i key derivation (32 bytes output for AES-256)
  const key = argon2i(passwordBytes, salt, {
    t: ARGON2_PARAMS.t,
    m: ARGON2_PARAMS.m,
    p: ARGON2_PARAMS.p,
    dkLen: 32, // Output 32 bytes for AES-256
  });

  // Create new Uint8Array to ensure correct ArrayBuffer type for Web Crypto API
  return new Uint8Array(key);
}

/**
 * Encrypts a private key using AES-256-GCM with Argon2id key derivation
 *
 * @param publicKeyBytes - ED25519 public key bytes (32 bytes)
 * @param privateKeyBytes - ED25519 private key bytes to encrypt (32 bytes)
 * @param password - Password for encryption
 * @param address - Blockchain address
 * @returns EncryptedKeyPair with encrypted data and salt
 * @throws Error if encryption fails
 */
export async function encryptPrivateKey(
  publicKeyBytes: Uint8Array,
  privateKeyBytes: Uint8Array,
  password: string,
  address: string,
): Promise<EncryptedCanopyKeyfile> {
  try {
    // Generate random 16-byte salt
    const salt = new Uint8Array(SALT_LENGTH);
    crypto.getRandomValues(salt);

    // Derive AES-256 key using Argon2i (synchronous)
    const derivedKey = deriveKey(password, salt);

    // Import key for Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      derivedKey.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    // Use first 12 bytes of derived key as nonce
    const nonce = derivedKey.slice(0, NONCE_LENGTH);

    // Encrypt private key with AES-GCM
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce.buffer as ArrayBuffer },
      cryptoKey,
      privateKeyBytes.buffer as ArrayBuffer,
    );

    return {
      publicKey: bytesToHex(publicKeyBytes),
      encrypted: bytesToHex(new Uint8Array(encryptedData)),
      salt: bytesToHex(salt),
      keyAddress: address,
      keyNickname: "",
    };
  } catch (error) {
    throw new Error(
      `Failed to encrypt private key: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Decrypts an encrypted private key using the password
 *
 * @param encryptedKeyPair - Encrypted key pair data
 * @param password - Password used for encryption
 * @returns Decrypted private key bytes
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export async function decryptPrivateKey(
  encryptedKeyPair: EncryptedCanopyKeyfile,
  password: string,
): Promise<Uint8Array> {
  try {
    // Decode hex-encoded data
    const salt = hexToBytes(encryptedKeyPair.salt);
    const encryptedData = hexToBytes(encryptedKeyPair.encrypted);

    // Derive same key using password and salt (synchronous)
    const derivedKey = deriveKey(password, salt);

    // Import key for Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      derivedKey.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // Use first 12 bytes of derived key as nonce
    const nonce = derivedKey.slice(0, NONCE_LENGTH);

    // Decrypt private key with AES-GCM
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce.buffer as ArrayBuffer },
      cryptoKey,
      encryptedData.buffer as ArrayBuffer,
    );

    return new Uint8Array(decryptedData);
  } catch (error) {
    // Web Crypto throws generic errors, provide more context
    if (error instanceof Error && error.name === "OperationError") {
      throw new Error(
        "There's a problem with your password. Please try again.",
      );
    }
    throw new Error(
      `Failed to decrypt private key: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verifies a password against an encrypted key pair
 *
 * @param encrypted - Encrypted key pair data
 * @param password - Password to verify
 * @returns true if password is correct, false otherwise
 */
export async function verifyPassword(
  encrypted: EncryptedCanopyKeyfile,
  password: string,
): Promise<boolean> {
  try {
    await decryptPrivateKey(encrypted, password);
    return true;
  } catch {
    return false;
  }
}
