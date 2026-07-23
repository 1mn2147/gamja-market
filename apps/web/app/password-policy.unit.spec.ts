import { describe, expect, it } from 'vitest';
import { evaluatePassword, passwordPolicyMessage } from './password-policy';

describe('client password policy', () => {
  it('matches the server-side strong password requirements', () => {
    expect(evaluatePassword('Orchid!Vault2026-Safe', ['buyer@example.test']).valid).toBe(true);
  });

  it('explains why a common password is rejected', () => {
    const result = evaluatePassword('Vault!Password2026-Safe', ['buyer@example.test']);
    expect(result.valid).toBe(false);
    expect(passwordPolicyMessage(result)).toContain('흔한 단어');
  });

  it('rejects a strong-looking password containing the email local part', () => {
    const result = evaluatePassword('Buyer!Vault2026-Safe', ['buyer@example.test']);
    expect(result.valid).toBe(false);
    expect(passwordPolicyMessage(result)).toContain('이메일 아이디');
  });
});
