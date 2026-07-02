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
    digits = `55${digits}`
  }

  return addBrazilianNinthDigit(digits)
}

const addBrazilianNinthDigit = (digits: string): string => {
  if (!digits.startsWith('55') || digits.length !== 12) {
    return digits
  }

  const ddd = digits.slice(2, 4)
  const subscriber = digits.slice(4)
  const isMobilePrefix = /^[6-9]/.test(subscriber)

  if (!isMobilePrefix) {
    return digits
  }

  return `55${ddd}9${subscriber}`
}

export const isValidZApiPhoneNumber = (value: string): boolean => {
  return /^\d{8,15}$/.test(value)
}
