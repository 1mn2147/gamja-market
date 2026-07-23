import { describe, expect, it } from 'vitest';
import { evaluatePassword } from '../src/auth/password-policy.js';

describe('password strength policy', () => {
  it('accepts a long mixed password that is unrelated to the account identifier', () => {
    expect(evaluatePassword('Orchid!Vault2026-Safe', ['buyer@example.test'])).toMatchObject({
      valid: true,
      lengthValid: true,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSpecialCharacter: true,
      avoidsCommonPattern: true,
      avoidsRepeatedRun: true,
      excludesIdentifier: true,
    });
  });

  it.each([
    ['lowercaseonly2026!', 'hasUppercase'],
    ['UPPERCASEONLY2026!', 'hasLowercase'],
    ['MissingNumber!Safe', 'hasNumber'],
    ['MissingSpecial2026Safe', 'hasSpecialCharacter'],
    ['Password123!', 'avoidsCommonPattern'],
    ['Vault!Password2026-Safe', 'avoidsCommonPattern'],
    ['Secure!654321-Value', 'avoidsCommonPattern'],
    ['Safe!AAAA2026value', 'avoidsRepeatedRun'],
    ['Buyer!Vault2026-Safe', 'excludesIdentifier'],
  ])('rejects %s when %s is not satisfied', (password, failedCheck) => {
    const result = evaluatePassword(password, ['buyer@example.test']);
    expect(result.valid).toBe(false);
    expect(result[failedCheck as keyof typeof result]).toBe(false);
  });
});
