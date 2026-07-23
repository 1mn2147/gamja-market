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

export function passwordPolicyMessage(result: PasswordPolicyResult) {
  if (!result.lengthValid) return '비밀번호는 12~128자로 입력해 주세요.';
  if (!result.hasUppercase) return '비밀번호에 영문 대문자를 1자 이상 포함해 주세요.';
  if (!result.hasLowercase) return '비밀번호에 영문 소문자를 1자 이상 포함해 주세요.';
  if (!result.hasNumber) return '비밀번호에 숫자를 1자 이상 포함해 주세요.';
  if (!result.hasSpecialCharacter) return '비밀번호에 공백이 아닌 특수문자를 1자 이상 포함해 주세요.';
  if (!result.avoidsCommonPattern) return '흔한 단어나 연속된 문자열을 비밀번호로 사용할 수 없습니다.';
  if (!result.avoidsRepeatedRun) return '같은 문자를 4번 이상 연속해서 사용할 수 없습니다.';
  if (!result.excludesIdentifier) return '이메일 아이디나 휴대전화 번호를 비밀번호에 포함할 수 없습니다.';
  return '';
}
