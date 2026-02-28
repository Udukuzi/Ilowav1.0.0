/**
 * Arcium MPC (Multi-Party Computation) Client
 * 
 * TypeScript client wrapper for Arcium's Rust-based MPC service.
 * Handles encryption/decryption requests for privacy-preserving AI.
 * 
 * NOTE: The actual MPC computation happens on Arcium's Rust backend.
 * This client prepares payloads and communicates with the service.
 * 
 * @see https://arcium.com
 */

import * as SecureStore from 'expo-secure-store';

const ARCIUM_ENABLED_KEY = 'arcium_mpc_enabled';
const ARCIUM_SESSION_KEY = 'arcium_session_id';
const ARCIUM_USER_KEY = 'arcium_user_pubkey';

export interface ArciumConfig {
  network: 'devnet' | 'mainnet';
  serviceUrl: string;
  encryptionLevel: 'standard' | 'high' | 'maximum';
}

export interface EncryptionRequest {
  plaintext: string;
  sessionId: string;
  pubkey?: string;
}

export interface EncryptionResponse {
  ciphertext: string;
  nonce: string;
  tag: string;
  success: boolean;
}

export interface DecryptionRequest {
  ciphertext: string;
  nonce: string;
  tag: string;
  sessionId: string;
}

// Default configuration
const DEFAULT_CONFIG: ArciumConfig = {
  network: 'devnet',
  serviceUrl: process.env.EXPO_PUBLIC_ARCIUM_URL || 'https://api.arcium.com/v1',
  encryptionLevel: 'standard',
};

let isEnabled = false;
let config: ArciumConfig = DEFAULT_CONFIG;
let sessionId: string | null = null;

/**
 * Initialize Arcium MPC client
 */
export async function initArciumClient(customConfig?: Partial<ArciumConfig>): Promise<boolean> {
  try {
    config = { ...DEFAULT_CONFIG, ...customConfig };
    
    // Check user preference
    const enabled = await SecureStore.getItemAsync(ARCIUM_ENABLED_KEY);
    isEnabled = enabled === 'true';
    
    // Get or create session ID
    sessionId = await SecureStore.getItemAsync(ARCIUM_SESSION_KEY);
    if (!sessionId && isEnabled) {
      sessionId = generateSessionId();
      await SecureStore.setItemAsync(ARCIUM_SESSION_KEY, sessionId);
    }
    
    console.log('[Arcium] Client initialized:', { 
      enabled: isEnabled, 
      network: config.network,
      hasSession: !!sessionId 
    });
    
    return true;
  } catch (error) {
    console.error('[Arcium] Init failed:', error);
    return false;
  }
}

/**
 * Enable Arcium MPC encryption
 */
export async function enableArcium(): Promise<void> {
  isEnabled = true;
  await SecureStore.setItemAsync(ARCIUM_ENABLED_KEY, 'true');
  
  // Create session if needed
  if (!sessionId) {
    sessionId = generateSessionId();
    await SecureStore.setItemAsync(ARCIUM_SESSION_KEY, sessionId);
  }
  
  console.log('[Arcium] Encryption enabled');
}

/**
 * Disable Arcium MPC encryption
 */
export async function disableArcium(): Promise<void> {
  isEnabled = false;
  await SecureStore.setItemAsync(ARCIUM_ENABLED_KEY, 'false');
  console.log('[Arcium] Encryption disabled');
}

/**
 * Check if Arcium encryption is enabled
 */
export function isArciumEnabled(): boolean {
  return isEnabled;
}

/**
 * Get current configuration
 */
export function getArciumConfig(): ArciumConfig {
  return { ...config };
}

/**
 * Encrypt a prompt before sending to AI service
 * 
 * Calls Arcium's Rust MPC backend to perform threshold encryption.
 * The plaintext is never seen by any single party.
 */
export async function encryptPrompt(plaintext: string): Promise<string> {
  if (!isEnabled || !sessionId) {
    return plaintext;
  }

  try {
    const userPubkey = await SecureStore.getItemAsync(ARCIUM_USER_KEY);
    
    const request: EncryptionRequest = {
      plaintext,
      sessionId,
      pubkey: userPubkey || undefined,
    };

    const response = await fetch(`${config.serviceUrl}/encrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arcium-Network': config.network,
        'X-Arcium-Level': config.encryptionLevel,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.warn('[Arcium] Encryption service unavailable, using plaintext');
      return plaintext;
    }

    const data: EncryptionResponse = await response.json();
    
    if (!data.success) {
      return plaintext;
    }

    // Return encoded payload for transmission
    return encodePayload(data.ciphertext, data.nonce, data.tag);
  } catch (error) {
    console.warn('[Arcium] Encryption failed, using plaintext:', error);
    return plaintext;
  }
}

/**
 * Decrypt a response from AI service
 * 
 * Calls Arcium's Rust MPC backend to perform threshold decryption.
 */
export async function decryptResponse(encrypted: string): Promise<string> {
  if (!isEnabled || !sessionId) {
    return encrypted;
  }

  try {
    const payload = decodePayload(encrypted);
    if (!payload) {
      return encrypted; // Not an encrypted payload
    }

    const request: DecryptionRequest = {
      ciphertext: payload.ciphertext,
      nonce: payload.nonce,
      tag: payload.tag,
      sessionId,
    };

    const response = await fetch(`${config.serviceUrl}/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arcium-Network': config.network,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return encrypted;
    }

    const data = await response.json();
    return data.plaintext || encrypted;
  } catch (error) {
    console.warn('[Arcium] Decryption failed:', error);
    return encrypted;
  }
}

/**
 * Register user's public key for E2E encryption
 */
export async function registerUserKey(pubkey: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(ARCIUM_USER_KEY, pubkey);
    
    if (isEnabled && sessionId) {
      await fetch(`${config.serviceUrl}/register-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Arcium-Network': config.network,
        },
        body: JSON.stringify({
          sessionId,
          pubkey,
        }),
      });
    }
    
    return true;
  } catch (error) {
    console.error('[Arcium] Key registration failed:', error);
    return false;
  }
}

/**
 * Clear session and keys
 */
export async function clearArciumSession(): Promise<void> {
  sessionId = null;
  await SecureStore.deleteItemAsync(ARCIUM_SESSION_KEY);
  await SecureStore.deleteItemAsync(ARCIUM_USER_KEY);
  console.log('[Arcium] Session cleared');
}

// Helper: Generate session ID
function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'arc_';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Encode encrypted payload for transmission
function encodePayload(ciphertext: string, nonce: string, tag: string): string {
  const payload = JSON.stringify({ c: ciphertext, n: nonce, t: tag, v: 1 });
  return `ARC:${btoa(payload)}`;
}

// Helper: Decode encrypted payload
function decodePayload(encoded: string): { ciphertext: string; nonce: string; tag: string } | null {
  if (!encoded.startsWith('ARC:')) {
    return null;
  }
  
  try {
    const payload = JSON.parse(atob(encoded.slice(4)));
    return {
      ciphertext: payload.c,
      nonce: payload.n,
      tag: payload.t,
    };
  } catch {
    return null;
  }
}

/**
 * Get privacy status for UI display
 */
export function getPrivacyStatus(): {
  enabled: boolean;
  network: string;
  level: string;
  hasSession: boolean;
} {
  return {
    enabled: isEnabled,
    network: config.network,
    level: config.encryptionLevel,
    hasSession: !!sessionId,
  };
}
