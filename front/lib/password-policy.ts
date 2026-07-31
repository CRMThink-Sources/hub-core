export const PASSWORD_MIN_LENGTH = 8

export type PasswordChecks = {
  length: boolean
  lower: boolean
  upper: boolean
  number: boolean
  special: boolean
}

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
}

export function isStrongPassword(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean)
}

export const PASSWORD_RULES: (keyof PasswordChecks)[] = [
  'length',
  'lower',
  'upper',
  'number',
  'special',
]
