import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { APP_CODES } from '@/shared/app/app-codes'
import {
  appTokenKey,
  clearAppToken,
  LEGACY_SHARED_TOKEN_KEY,
  readAppToken,
  writeAppToken,
} from './app-token-storage'

function makeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

const originalWindow = globalThis.window

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: makeStorage() },
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  })
})

describe('appTokenKey', () => {
  it('deriva a chave do appCode canônico', () => {
    expect(appTokenKey(APP_CODES.thinkzap)).toBe(
      'hubthink_auth_token:crmthink.thinkzap',
    )
  })

  it('gera chaves distintas por app', () => {
    const keys = Object.values(APP_CODES).map(appTokenKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('leitura e escrita', () => {
  it('grava e lê o token da própria app', () => {
    writeAppToken(APP_CODES.thinkzap, 'jwt-zap')
    expect(readAppToken(APP_CODES.thinkzap)).toBe('jwt-zap')
  })

  it('devolve null quando não há token da app', () => {
    expect(readAppToken(APP_CODES.clicksign)).toBeNull()
  })

  it('duas apps no mesmo navegador não se sobrescrevem', () => {
    writeAppToken(APP_CODES.thinkzap, 'jwt-zap')
    writeAppToken(APP_CODES.thinkanalise, 'jwt-analise')

    expect(readAppToken(APP_CODES.thinkzap)).toBe('jwt-zap')
    expect(readAppToken(APP_CODES.thinkanalise)).toBe('jwt-analise')
  })

  it('trata valor na chave compartilhada antiga como ausência de token', () => {
    window.sessionStorage.setItem(LEGACY_SHARED_TOKEN_KEY, 'jwt-de-outra-app')

    expect(readAppToken(APP_CODES.thinkzap)).toBeNull()
  })

  it('clearAppToken remove só o token daquela app', () => {
    writeAppToken(APP_CODES.thinkzap, 'jwt-zap')
    writeAppToken(APP_CODES.importsheet, 'jwt-sheet')

    clearAppToken(APP_CODES.thinkzap)

    expect(readAppToken(APP_CODES.thinkzap)).toBeNull()
    expect(readAppToken(APP_CODES.importsheet)).toBe('jwt-sheet')
  })
})

describe('fora do navegador', () => {
  it('não lança e devolve null quando window não existe', () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    expect(readAppToken(APP_CODES.thinkzap)).toBeNull()
    expect(() => writeAppToken(APP_CODES.thinkzap, 'jwt')).not.toThrow()
    expect(() => clearAppToken(APP_CODES.thinkzap)).not.toThrow()
  })
})
