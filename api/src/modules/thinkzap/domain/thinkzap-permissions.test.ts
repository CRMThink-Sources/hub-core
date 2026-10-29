import { describe, expect, it } from 'vitest'
import { parseThinkzapUserPermissions } from './thinkzap-permissions'

describe('parseThinkzapUserPermissions', () => {
  it('deriva thinkbot de connectors em row anterior à categoria, sem perder finance', () => {
    const parsed = parseThinkzapUserPermissions({
      connectors: { read: true, create: false, update: true, delete: false },
      finance: { read: true, create: true, update: false, delete: false },
    })

    expect(parsed.finance).toEqual({
      read: true,
      create: true,
      update: false,
      delete: false,
    })
    expect(parsed.thinkbot).toEqual({
      read: true,
      create: false,
      update: true,
      delete: false,
      publish: true,
    })
  })

  it('mantém thinkbot gravado', () => {
    const thinkbot = {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: false,
    }
    const parsed = parseThinkzapUserPermissions({
      connectors: { read: true, create: true, update: true, delete: true },
      finance: { read: false, create: false, update: false, delete: false },
      thinkbot,
    })

    expect(parsed.thinkbot).toEqual(thinkbot)
  })
})
