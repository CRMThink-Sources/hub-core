import { describe, expect, it } from 'vitest'
import { isLineAllowed, resolveLineAccess } from './resolve-line-access'

describe('resolveLineAccess', () => {
  it('sem grupos na instalação não restringe', () => {
    expect(resolveLineAccess({ hasGroups: false, userLineIds: [] })).toEqual({
      restricted: false,
      allowedLineIds: [],
    })
  })

  it('com grupos, une e deduplica as linhas dos grupos do usuário', () => {
    expect(
      resolveLineAccess({ hasGroups: true, userLineIds: ['1', '1', '2'] }),
    ).toEqual({ restricted: true, allowedLineIds: ['1', '2'] })
  })

  it('com grupos, usuário sem grupo ou com grupos sem linhas fica sem linha', () => {
    expect(resolveLineAccess({ hasGroups: true, userLineIds: [] })).toEqual({
      restricted: true,
      allowedLineIds: [],
    })
  })
})

describe('isLineAllowed', () => {
  it('libera qualquer linha quando não restrito', () => {
    expect(isLineAllowed({ restricted: false, allowedLineIds: [] }, '9')).toBe(
      true,
    )
  })

  it('restrito só libera as linhas dos grupos', () => {
    const access = { restricted: true, allowedLineIds: ['1'] }
    expect(isLineAllowed(access, '1')).toBe(true)
    expect(isLineAllowed(access, '2')).toBe(false)
  })
})
