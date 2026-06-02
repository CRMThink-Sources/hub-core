export const normalizePhoneNumber = (value: string): string => {
  const hasInternationalPrefix = value.startsWith('+') || value.startsWith('00')
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  digits = digits.replace(/^0+/, '')

  if (
    !hasInternationalPrefix &&
    (digits.length === 10 || digits.length === 11)
  ) {
    return `55${digits}`
  }

  return digits
}

export const isValidZApiPhoneNumber = (value: string): boolean => {
  return /^\d{8,15}$/.test(value)
}
