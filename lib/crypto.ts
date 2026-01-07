/**
 * Secure Web Crypto API utilities for keyfile encryption/decryption
 */

import { ENV_CONFIG } from "@/config/reown";

export interface EncryptedData {
  encryptedData: string;
  salt: string;
  iv: string;
}

export class CryptoUtils {
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;
  private static readonly KEY_LENGTH = 256;
  private static readonly ITERATIONS = 100000; // PBKDF2 iterations

  /**
   * Generate a cryptographically secure random salt
   */
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * Generate a cryptographically secure random IV
   */
  private static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }

  /**
   * Derive encryption key from app secret using PBKDF2
   */
  private static async deriveKey(
    appSecret: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const secretBuffer = encoder.encode(appSecret);

    // Import app secret as raw key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      secretBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt.buffer as ArrayBuffer,
        iterations: this.ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: this.KEY_LENGTH },
      false,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypt data using AES-GCM with app secret-derived key
   */
  static async encrypt(data: string): Promise<EncryptedData> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate salt and IV
      const salt = this.generateSalt();
      const iv = this.generateIV();

      // Derive key from app secret
      const key = await this.deriveKey(ENV_CONFIG.KEYFILE_SECRET!, salt);

      // Encrypt data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv.buffer as ArrayBuffer,
        },
        key,
        dataBuffer,
      );

      // Convert to base64 for storage
      return {
        encryptedData: this.arrayBufferToBase64(encryptedBuffer),
        salt: this.arrayBufferToBase64(salt.buffer),
        iv: this.arrayBufferToBase64(iv.buffer),
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-GCM with app secret-derived key
   */
  static async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      // Convert from base64
      const dataBuffer = this.base64ToArrayBuffer(encryptedData.encryptedData);
      const salt = new Uint8Array(this.base64ToArrayBuffer(encryptedData.salt));
      const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedData.iv));

      // Derive key from app secret
      const key = await this.deriveKey(ENV_CONFIG.KEYFILE_SECRET!, salt);

      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv.buffer as ArrayBuffer,
        },
        key,
        dataBuffer,
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Generate a secure hash of data (for integrity checking)
   */
  static async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Securely clear sensitive data from memory (best effort)
   */
  static clearSensitiveData(...data: (string | undefined)[]): void {
    data.forEach((item) => {
      if (item && typeof item === "string") {
        // Overwrite string content (limited effectiveness in JS)
        item = "\0".repeat(item.length);
      }
    });
  }
}
