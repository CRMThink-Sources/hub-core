import { describe, expect, it } from 'vitest'
import { isInsideIframe } from './is-inside-iframe'

describe('isInsideIframe', () => {
  it('é false numa página top-level', () => {
    const win = {} as Window
    Object.assign(win, { self: win, top: win })
    expect(isInsideIframe(win)).toBe(false)
  })

  it('é true quando o top é outra janela', () => {
    const win = {} as Window
    Object.assign(win, { self: win, top: {} as Window })
    expect(isInsideIframe(win)).toBe(true)
  })

  it('é true quando ler window.top lança', () => {
    const win = {} as Window
    Object.defineProperty(win, 'self', { value: win })
    Object.defineProperty(win, 'top', {
      get() {
        throw new Error('SecurityError')
      },
    })
    expect(isInsideIframe(win)).toBe(true)
  })

  it('é false sem window (SSR)', () => {
    expect(isInsideIframe(undefined)).toBe(false)
  })
})
