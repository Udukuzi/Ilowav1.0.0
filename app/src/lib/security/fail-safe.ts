import { checkArciumHealth } from '../privacy/arcium';

/**
 * Fail-safe: If privacy layer fails, ABORT transaction (don't degrade to public).
 * Never silently fall back to public mode.
 */
export async function executeWithPrivacyGuarantee<T>(
  operation: () => Promise<T>,
  privacyRequired: boolean
): Promise<T> {
  if (!privacyRequired) {
    return await operation();
  }

  // Privacy mode: MUST succeed or fail entirely
  const arciumOnline = await checkArciumHealth();
  if (!arciumOnline) {
    throw new PrivacyGuaranteeError(
      'Privacy service unavailable. Cannot proceed with private transaction.'
    );
  }

  let result: T;
  try {
    result = await operation();
  } catch (error) {
    throw new PrivacyGuaranteeError(
      `Privacy-protected operation failed: ${error instanceof Error ? error.message : String(error)}\n\n` +
      'Your transaction was NOT sent to preserve your privacy.\n' +
      'Please try again or disable private mode.'
    );
  }

  // Verify privacy was actually applied
  if (!verifyPrivacyApplied(result)) {
    throw new PrivacyGuaranteeError(
      'Privacy verification failed. Transaction aborted.\n' +
      'The operation completed but privacy could not be confirmed.'
    );
  }

  return result;
}

/**
 * Custom error class for privacy guarantee failures.
 * UI can catch this specifically to show the right messaging.
 */
export class PrivacyGuaranteeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivacyGuaranteeError';
  }
}

function verifyPrivacyApplied(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const obj = result as Record<string, unknown>;
  return 'encrypted_amount' in obj || 'zk_proof' in obj || typeof result === 'string';
}
