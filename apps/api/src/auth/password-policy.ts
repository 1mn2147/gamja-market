const COMMON_PASSWORD_PREFIXES = [
  'password',
  'passw0rd',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'administrator',
  'iloveyou',
  'gamjamarket',
  'potato',
];

const PREDICTABLE_SEQUENCES = [
  '012345',
  '123456',
  '234567',
  '345678',
  '654321',
  '543210',
  'abcdef',
  'fedcba',
  'qwerty',
  'asdfgh',
  'zxcvbn',
];

export type PasswordPolicyResult = {
  valid: boolean;
  lengthValid: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialCharacter: boolean;
  avoidsCommonPattern: boolean;
  avoidsRepeatedRun: boolean;
  excludesIdentifier: boolean;
};

function compact(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function identifierTokens(identifiers: string[]) {
  const tokens = new Set<string>();
  for (const value of identifiers) {
    const normalized = value.normalize('NFKC').toLowerCase().trim();
    const localPart = normalized.includes('@') ? normalized.split('@')[0] ?? '' : normalized;
    const compactValue = compact(localPart);
    if (compactValue.length >= 4) tokens.add(compactValue);
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 8) tokens.add(digits);
  }
  return [...tokens];
}

export function evaluatePassword(password: string, identifiers: string[] = []): PasswordPolicyResult {
  const compactPassword = compact(password);
  const lengthValid = password.length >= 12 && password.length <= 128;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9\s]/u.test(password);
  const avoidsCommonPattern = !COMMON_PASSWORD_PREFIXES.some((common) => compactPassword.includes(common))
    && !PREDICTABLE_SEQUENCES.some((sequence) => compactPassword.includes(sequence));
  const avoidsRepeatedRun = !/(.)\1{3,}/u.test(password);
  const excludesIdentifier = !identifierTokens(identifiers)
    .some((token) => compactPassword.includes(token));
  return {
    valid: lengthValid
      && hasUppercase
      && hasLowercase
      && hasNumber
      && hasSpecialCharacter
      && avoidsCommonPattern
      && avoidsRepeatedRun
      && excludesIdentifier,
    lengthValid,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialCharacter,
    avoidsCommonPattern,
    avoidsRepeatedRun,
    excludesIdentifier,
  };
}
