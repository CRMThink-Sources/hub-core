export const normalizePhoneNumber = (value: string): string => {
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  digits = digits.replace(/^0+/, '')

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

export const isValidZApiPhoneNumber = (value: string): boolean => {
  return /^55\d{10,11}$/.test(value)
}
