import { describe, expect, it, vi } from 'vitest'
import { fakeSource } from './insights-test-helpers'
import {
  runWithSourceFallback,
  type InsightsSourceFailureHandler,
  type InsightsSourceResolver,
} from './resolve-insights-source'

describe('runWithSourceFallback', () => {
  const revoked = new Error('recusada')

  const setup = () => {
    const full = fakeSource({ mode: 'full', sessions: [] })
    full.sessions.mockRejectedValue(revoked)
    const lean = fakeSource({ mode: 'lean', sessions: [] })
    let calls = 0
    const resolveSource = vi.fn<InsightsSourceResolver>(() =>
      Promise.resolve(calls++ === 0 ? full.source : lean.source),
    )
    const onSourceFailure = vi.fn<InsightsSourceFailureHandler>(
      (_appId, e) => e === revoked,
    )
    const run = (source: typeof full.source) =>
      source.sessions(new Date(0), new Date()).then(() => source.mode)
    return { full, lean, resolveSource, onSourceFailure, run }
  }

  it('fonte que funciona: roda uma vez, sem consultar o handler', async () => {
    const { lean, onSourceFailure } = setup()
    const resolveSource = vi.fn<InsightsSourceResolver>(() =>
      Promise.resolve(lean.source),
    )
    const mode = await runWithSourceFallback(
      'app-1',
      { resolveSource, onSourceFailure },
      s => Promise.resolve(s.mode),
    )
    expect(mode).toBe('lean')
    expect(resolveSource).toHaveBeenCalledTimes(1)
    expect(onSourceFailure).not.toHaveBeenCalled()
  })

  it('chave revogada: refaz com a fonte nova e devolve o modo de fato usado', async () => {
    const { resolveSource, onSourceFailure, run } = setup()
    const mode = await runWithSourceFallback(
      'app-1',
      { resolveSource, onSourceFailure },
      run,
    )
    expect(onSourceFailure).toHaveBeenCalledWith('app-1', revoked)
    expect(resolveSource).toHaveBeenCalledTimes(2)
    expect(mode).toBe('lean')
  })

  it('aceita um handler assíncrono', async () => {
    const { resolveSource, run } = setup()
    const mode = await runWithSourceFallback(
      'app-1',
      {
        resolveSource,
        onSourceFailure: () => Promise.resolve(true),
      },
      run,
    )
    expect(mode).toBe('lean')
  })

  it('erro que o handler não reconhece sobe sem segunda tentativa', async () => {
    const { resolveSource, onSourceFailure } = setup()
    const other = new Error('5xx')
    const full = fakeSource({ mode: 'full', sessions: [] })
    full.sessions.mockRejectedValue(other)
    resolveSource.mockResolvedValue(full.source)
    await expect(
      runWithSourceFallback('app-1', { resolveSource, onSourceFailure }, s =>
        s.sessions(new Date(0), new Date()),
      ),
    ).rejects.toBe(other)
    expect(resolveSource).toHaveBeenCalledTimes(1)
  })

  it('sem handler, o erro sobe', async () => {
    const { resolveSource, run } = setup()
    await expect(
      runWithSourceFallback('app-1', { resolveSource }, run),
    ).rejects.toBe(revoked)
  })

  it('tenta de novo uma vez só', async () => {
    const { resolveSource, onSourceFailure } = setup()
    const full = fakeSource({ mode: 'full', sessions: [] })
    full.sessions.mockRejectedValue(revoked)
    resolveSource.mockResolvedValue(full.source)
    await expect(
      runWithSourceFallback('app-1', { resolveSource, onSourceFailure }, s =>
        s.sessions(new Date(0), new Date()),
      ),
    ).rejects.toBe(revoked)
    expect(resolveSource).toHaveBeenCalledTimes(2)
  })
})
