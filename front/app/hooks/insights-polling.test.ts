import { describe, expect, it, vi } from 'vitest'
import {
  COMPUTING_POLL_MS,
  InsightsWaitTimeoutError,
  MAX_WAIT_MS,
  STALE_REFRESH_POLL_MS,
  isComputing,
  pollUntilReady,
  refreshWhileStale,
  type ComputingBody,
} from './insights-polling'

const computing: ComputingBody = { status: 'computing', startedAt: 1 }
type Panel = { mode: string; stale?: boolean }

/** Relógio falso: `sleep` só avança o tempo, sem esperar de verdade. */
function clock() {
  let t = 0
  return {
    now: () => t,
    sleep: vi.fn((ms: number) => {
      t += ms
      return Promise.resolve()
    }),
  }
}

describe('isComputing', () => {
  it('reconhece só o corpo de "calculando"', () => {
    expect(isComputing({ status: 'computing', startedAt: 1 })).toBe(true)
    expect(isComputing({ mode: 'full' })).toBe(false)
    expect(isComputing(null)).toBe(false)
    expect(isComputing('computing')).toBe(false)
  })
})

describe('pollUntilReady', () => {
  it('202 seguido de 200: repete a cada 3 s e devolve o painel', async () => {
    const c = clock()
    const get = vi
      .fn<() => Promise<Panel | ComputingBody>>()
      .mockResolvedValueOnce(computing)
      .mockResolvedValueOnce(computing)
      .mockResolvedValueOnce({ mode: 'full' })
    const onComputing = vi.fn()

    const out = await pollUntilReady(get, {
      isCancelled: () => false,
      onComputing,
      ...c,
    })

    expect(out).toEqual({ mode: 'full' })
    expect(get).toHaveBeenCalledTimes(3)
    expect(c.sleep).toHaveBeenCalledTimes(2)
    expect(c.sleep).toHaveBeenCalledWith(COMPUTING_POLL_MS)
    expect(onComputing).toHaveBeenCalledTimes(2)
  })

  it('resposta pronta de primeira: não espera nem avisa "calculando"', async () => {
    const c = clock()
    const onComputing = vi.fn()
    const out = await pollUntilReady(() => Promise.resolve({ mode: 'lean' }), {
      isCancelled: () => false,
      onComputing,
      ...c,
    })
    expect(out).toEqual({ mode: 'lean' })
    expect(c.sleep).not.toHaveBeenCalled()
    expect(onComputing).not.toHaveBeenCalled()
  })

  it('202 seguido de erro (502): o erro sobe para a tela mostrar', async () => {
    const c = clock()
    const boom = new Error('502')
    const get = vi
      .fn<() => Promise<Panel | ComputingBody>>()
      .mockResolvedValueOnce(computing)
      .mockRejectedValueOnce(boom)
    await expect(
      pollUntilReady(get, { isCancelled: () => false, ...c }),
    ).rejects.toBe(boom)
  })

  it('trocar a consulta no meio da espera: devolve null e para de consultar', async () => {
    const c = clock()
    let cancelled = false
    const get = vi.fn<() => Promise<Panel | ComputingBody>>(() => {
      cancelled = true
      return Promise.resolve(computing)
    })
    const out = await pollUntilReady(get, {
      isCancelled: () => cancelled,
      ...c,
    })
    expect(out).toBeNull()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('resposta atrasada de uma consulta cancelada não é entregue', async () => {
    const c = clock()
    let cancelled = false
    const get = () => {
      cancelled = true
      return Promise.resolve({ mode: 'antigo' })
    }
    expect(
      await pollUntilReady(get, { isCancelled: () => cancelled, ...c }),
    ).toBeNull()
  })

  it('desiste depois do prazo máximo com um erro próprio', async () => {
    const c = clock()
    const get = vi.fn(() => Promise.resolve(computing))
    await expect(
      pollUntilReady(get, { isCancelled: () => false, ...c }),
    ).rejects.toBeInstanceOf(InsightsWaitTimeoutError)
    // Tentou até o prazo: ~16 min a cada 3 s.
    expect(get.mock.calls.length).toBeGreaterThan(
      Math.floor(MAX_WAIT_MS / COMPUTING_POLL_MS) - 2,
    )
  })
})

describe('refreshWhileStale', () => {
  it('painel recente (sem stale): não consulta nada', async () => {
    const c = clock()
    const get = vi.fn()
    await refreshWhileStale(
      get,
      { mode: 'full' },
      {
        isCancelled: () => false,
        onData: vi.fn(),
        ...c,
      },
    )
    expect(get).not.toHaveBeenCalled()
  })

  it('desatualizado: consulta até a versão nova e a entrega', async () => {
    const c = clock()
    const get = vi
      .fn<() => Promise<Panel | ComputingBody>>()
      .mockResolvedValueOnce({ mode: 'full', stale: true })
      .mockResolvedValueOnce({ mode: 'full' })
    const onData = vi.fn()

    await refreshWhileStale(
      get,
      { mode: 'full', stale: true },
      {
        isCancelled: () => false,
        onData,
        ...c,
      },
    )

    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith({ mode: 'full' })
    expect(c.sleep).toHaveBeenCalledWith(STALE_REFRESH_POLL_MS)
  })

  it('cancelada pela troca de filtro: não entrega nada', async () => {
    const c = clock()
    let cancelled = false
    const get = vi.fn(() => {
      cancelled = true
      return Promise.resolve({ mode: 'novo' } as Panel)
    })
    const onData = vi.fn()
    await refreshWhileStale(
      get,
      { mode: 'full', stale: true },
      {
        isCancelled: () => cancelled,
        onData,
        ...c,
      },
    )
    expect(onData).not.toHaveBeenCalled()
  })

  it('erro na consulta: encerra em silêncio e mantém o painel antigo', async () => {
    const c = clock()
    const onData = vi.fn()
    await expect(
      refreshWhileStale(
        () => Promise.reject(new Error('rede')),
        { mode: 'full', stale: true },
        { isCancelled: () => false, onData, ...c },
      ),
    ).resolves.toBeUndefined()
    expect(onData).not.toHaveBeenCalled()
  })

  it('para depois do prazo máximo se a versão nova nunca chega', async () => {
    const c = clock()
    const get = vi.fn(() =>
      Promise.resolve({ mode: 'full', stale: true } as Panel),
    )
    const onData = vi.fn()
    await refreshWhileStale(
      get,
      { mode: 'full', stale: true },
      {
        isCancelled: () => false,
        onData,
        ...c,
      },
    )
    expect(onData).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalled()
  })
})
