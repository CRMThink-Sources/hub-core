import { describe, expect, it } from 'vitest'
import {
  INITIAL_WALKTHROUGH,
  walkthroughReducer,
  type WalkthroughAction,
  type WalkthroughState,
} from './walkthrough-state'

const reduce = (state: WalkthroughState, action: WalkthroughAction) =>
  walkthroughReducer(3, state, action)

describe('walkthroughReducer', () => {
  it('avança um passo por vez', () => {
    expect(reduce(INITIAL_WALKTHROUGH, { type: 'next' })).toEqual({
      step: 1,
      done: false,
    })
  })

  it('conclui ao avançar do último passo e para ali', () => {
    const done = reduce({ step: 2, done: false }, { type: 'next' })
    expect(done).toEqual({ step: 2, done: true })
    expect(reduce(done, { type: 'next' })).toBe(done)
  })

  it('voltar na conclusão reabre o último passo', () => {
    expect(reduce({ step: 2, done: true }, { type: 'prev' })).toEqual({
      step: 2,
      done: false,
    })
  })

  it('não volta antes do primeiro passo', () => {
    expect(reduce(INITIAL_WALKTHROUGH, { type: 'prev' })).toEqual(
      INITIAL_WALKTHROUGH,
    )
  })

  it.each([
    [1, 1],
    [-4, 0],
    [99, 2],
  ])('goTo(%i) vai para o passo %i', (target, expected) => {
    expect(
      reduce({ step: 2, done: true }, { type: 'goTo', step: target }),
    ).toEqual({ step: expected, done: false })
  })

  it('recomeça do primeiro passo', () => {
    expect(reduce({ step: 2, done: true }, { type: 'restart' })).toEqual(
      INITIAL_WALKTHROUGH,
    )
  })
})
