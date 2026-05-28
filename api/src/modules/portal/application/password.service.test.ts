import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.service'

describe('password.service', () => {
  it('hashes and verifies a password', async () => {
    const password = 'secure-password-123'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await bcrypt.hash('correct', 12)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
