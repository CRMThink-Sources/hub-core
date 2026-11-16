import { describe, expect, it } from 'vitest'
import type { CadencePolicy } from '@/modules/thinkzap/domain/send-cadence'
import {
  RedisSendCadence,
  type RedisSendCadenceOptions,
  cadenceDestKey,
  cadenceQueueKey,
  cadenceStateKey,
  cadenceTicketDestKey,
} from './redis-send-cadence'
import { fakeCadenceRedis } from './redis-send-cadence.fake'

const LINE = 'inst-1'
const MIN = 60_000
const T0 = Date.parse('2026-10-21T13:00:00.000Z')
const at = (ms: number) => new Date(T0 + ms)

const policy = (over: Partial<CadencePolicy> = {}): CadencePolicy => ({
  lineKey: LINE,
  enabled: true,
  maxMessages: 20,
  windowMs: MIN,
  pauseMs: 0,
  ...over,
})

function makeSut(options: RedisSendCadenceOptions = {}) {
  const fake = fakeCadenceRedis()
  // random fixo: o retry de quem não é a cabeça fica previsível (500 ms).
  const cadence = new RedisSendCadence(fake.redis, () => 0, options)
  let n = 0
  const enqueue = async (destination = 'dest-1') => {
    const id = `ob-${++n}`
    const seq = await cadence.enqueue(LINE, id, destination)
    return { outboxId: id, seq, destination }
  }
  return { ...fake, cadence, enqueue }
}

describe('RedisSendCadence — janela e pausa', () => {
  it('a janela abre no primeiro envio, não no relógio', async () => {
    const { cadence, enqueue } = makeSut()
    const t = await enqueue()

    const out = await cadence.reserve(policy(), t, at(37_000))

    expect(out).toEqual({ allowed: true, windowId: T0 + 37_000 })
    expect(await cadence.state(LINE, at(37_000))).toMatchObject({
      phase: 'window',
      count: 1,
      max: 20,
      windowEndsAt: T0 + 37_000 + MIN,
    })
  })

  it('janela cheia nega com retryAt = fim da janela', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ maxMessages: 2 })

    await cadence.reserve(p, await enqueue(), at(0))
    await cadence.reserve(p, await enqueue(), at(1_000))
    const out = await cadence.reserve(p, await enqueue(), at(2_000))

    expect(out).toEqual({
      allowed: false,
      retryAt: T0 + MIN,
      reason: 'window-full',
    })
  })

  it('sem pausa, a janela seguinte abre no fim da anterior', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ maxMessages: 1 })

    await cadence.reserve(p, await enqueue(), at(0))
    const t = await enqueue()
    expect((await cadence.reserve(p, t, at(59_999))).allowed).toBe(false)

    expect(await cadence.reserve(p, t, at(MIN))).toEqual({
      allowed: true,
      windowId: T0 + MIN,
    })
  })

  it('a pausa começa na N-ésima mensagem e substitui o restante da janela', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ pauseMs: 5 * MIN })

    for (let i = 0; i < 19; i++) {
      await cadence.reserve(p, await enqueue(), at(i * 1_000))
    }
    // 20ª às 10:00:40 do cenário.
    await cadence.reserve(p, await enqueue(), at(40_000))

    const t21 = await enqueue()
    expect(await cadence.reserve(p, t21, at(61_000))).toEqual({
      allowed: false,
      retryAt: T0 + 40_000 + 5 * MIN,
      reason: 'paused',
    })
    expect(await cadence.reserve(p, t21, at(40_000 + 5 * MIN))).toEqual({
      allowed: true,
      windowId: T0 + 40_000 + 5 * MIN,
    })
  })

  it('cadência desligada sem janela aceita sem contar', async () => {
    const { cadence, enqueue } = makeSut()
    const off = policy({ enabled: false })

    for (let i = 0; i < 50; i++) {
      expect((await cadence.reserve(off, await enqueue(), at(i))).allowed).toBe(
        true,
      )
    }
    expect((await cadence.state(LINE, at(100))).phase).toBe('idle')
  })

  it('release só devolve a vaga da mesma janela', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ maxMessages: 2 })

    const first = await cadence.reserve(p, await enqueue(), at(0))
    await cadence.reserve(p, await enqueue(), at(1))
    if (!first.allowed) throw new Error('esperava vaga')

    await cadence.release(LINE, first.windowId)
    expect((await cadence.state(LINE, at(2))).count).toBe(1)

    // Outra janela: o id antigo não mexe mais na contagem.
    await cadence.reserve(p, await enqueue(), at(3))
    await cadence.reserve(p, await enqueue(), at(MIN))
    await cadence.release(LINE, first.windowId)
    expect((await cadence.state(LINE, at(MIN + 1))).count).toBe(1)
  })
})

describe('RedisSendCadence — mudança vale na próxima janela', () => {
  it('reduzir N no meio da janela mantém o snapshot', async () => {
    const { cadence, enqueue } = makeSut()

    for (let i = 0; i < 12; i++) {
      await cadence.reserve(policy(), await enqueue(), at(i))
    }
    const reduzida = policy({ maxMessages: 10 })
    for (let i = 12; i < 20; i++) {
      expect(
        (await cadence.reserve(reduzida, await enqueue(), at(i))).allowed,
      ).toBe(true)
    }
    const t = await enqueue()
    expect((await cadence.reserve(reduzida, t, at(30))).allowed).toBe(false)

    await cadence.reserve(reduzida, t, at(MIN))
    expect(await cadence.state(LINE, at(MIN))).toMatchObject({ max: 10 })
  })

  it('mudar P durante a pausa não altera o fim dela', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ maxMessages: 1, pauseMs: 5 * MIN })

    await cadence.reserve(p, await enqueue(), at(0))
    const t = await enqueue()
    const out = await cadence.reserve(
      policy({ maxMessages: 1, pauseMs: 10 * MIN }),
      t,
      at(MIN),
    )

    expect(out).toMatchObject({ allowed: false, retryAt: T0 + 5 * MIN })
    // A próxima pausa já usa os 10 minutos.
    await cadence.reserve(
      policy({ maxMessages: 1, pauseMs: 10 * MIN }),
      t,
      at(5 * MIN),
    )
    expect((await cadence.state(LINE, at(5 * MIN + 1))).pauseUntil).toBe(
      T0 + 15 * MIN,
    )
  })

  it('desativar durante a pausa só libera depois de pauseUntil', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ maxMessages: 1, pauseMs: 5 * MIN })
    await cadence.reserve(p, await enqueue(), at(0))

    const off = policy({ enabled: false })
    const t = await enqueue()
    expect((await cadence.reserve(off, t, at(MIN))).allowed).toBe(false)

    expect(await cadence.reserve(off, t, at(5 * MIN))).toEqual({
      allowed: true,
      windowId: 0,
    })
  })
})

describe('RedisSendCadence — espelhadas', () => {
  it('conta na janela aberta', async () => {
    const { cadence, enqueue } = makeSut()
    await cadence.reserve(policy(), await enqueue(), at(0))

    await cadence.registerExternal(policy(), at(1))

    expect((await cadence.state(LINE, at(2))).count).toBe(2)
  })

  it('abre uma janela quando não há nenhuma', async () => {
    const { cadence } = makeSut()

    await cadence.registerExternal(policy(), at(10))

    expect(await cadence.state(LINE, at(11))).toMatchObject({
      phase: 'window',
      count: 1,
      windowEndsAt: T0 + 10 + MIN,
    })
  })

  it('dispara a pausa no N-ésimo envio', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ pauseMs: 5 * MIN })
    for (let i = 0; i < 19; i++) {
      await cadence.reserve(p, await enqueue(), at(i))
    }

    await cadence.registerExternal(p, at(100))

    expect(await cadence.state(LINE, at(101))).toMatchObject({
      phase: 'paused',
      pauseUntil: T0 + 100 + 5 * MIN,
    })
  })

  it('é no-op durante a pausa ou com a janela cheia', async () => {
    const { cadence, enqueue } = makeSut()
    const p = policy({ maxMessages: 1, pauseMs: 5 * MIN })
    await cadence.reserve(p, await enqueue(), at(0))

    await cadence.registerExternal(p, at(MIN))
    expect((await cadence.state(LINE, at(MIN))).pauseUntil).toBe(T0 + 5 * MIN)

    const cheia = makeSut()
    const sem = policy({ maxMessages: 1 })
    await cheia.cadence.reserve(sem, await cheia.enqueue(), at(0))
    await cheia.cadence.registerExternal(sem, at(1))
    expect(await cheia.cadence.state(LINE, at(2))).toMatchObject({
      count: 1,
      windowEndsAt: T0 + MIN,
    })
  })

  it('não conta com a cadência desligada e sem janela', async () => {
    const { cadence } = makeSut()

    await cadence.registerExternal(policy({ enabled: false }), at(0))

    expect((await cadence.state(LINE, at(1))).phase).toBe('idle')
  })
})

describe('RedisSendCadence — FIFO por linha', () => {
  it('só a cabeça recebe a vaga; os outros recebem not-head', async () => {
    const { cadence, enqueue } = makeSut()
    const a = await enqueue()
    const b = await enqueue()

    expect(await cadence.reserve(policy(), b, at(0))).toEqual({
      allowed: false,
      retryAt: T0 + 500,
      reason: 'not-head',
    })
    expect((await cadence.reserve(policy(), a, at(1))).allowed).toBe(true)
    expect((await cadence.reserve(policy(), b, at(2))).allowed).toBe(true)
  })

  it('a FIFO vale com a cadência desligada', async () => {
    const { cadence, enqueue } = makeSut()
    const off = policy({ enabled: false })
    const a = await enqueue()
    const b = await enqueue()

    expect((await cadence.reserve(off, b, at(0))).allowed).toBe(false)
    expect((await cadence.reserve(off, a, at(0))).allowed).toBe(true)
  })

  it('ticket removido e reinserido mantém a posição pelo queueSeq', async () => {
    const { cadence, enqueue, ordered } = makeSut()
    const a = await enqueue()
    const b = await enqueue()

    // Perda do Redis/flush da fila: o ticket volta com o seq gravado.
    await cadence.dequeue(LINE, a.outboxId)
    expect(ordered(cadenceQueueKey(LINE))).toEqual([b.outboxId])

    const outB = await cadence.reserve(policy(), b, at(0))
    expect(outB.allowed).toBe(true)

    const c = await enqueue()
    await cadence.reserve(policy(), a, at(1))
    expect(ordered(cadenceQueueKey(LINE))).toEqual([c.outboxId])
  })

  it('concedida a vaga, o ticket sai da fila', async () => {
    const { cadence, enqueue, ordered } = makeSut()
    const a = await enqueue()

    await cadence.reserve(policy(), a, at(0))

    expect(ordered(cadenceQueueKey(LINE))).toEqual([])
  })

  it('negado por pausa, o ticket continua na fila na mesma posição', async () => {
    const { cadence, enqueue, ordered } = makeSut()
    const p = policy({ maxMessages: 1, pauseMs: MIN })
    await cadence.reserve(p, await enqueue(), at(0))
    const b = await enqueue()
    const c = await enqueue()

    await cadence.reserve(p, c, at(1))
    await cadence.reserve(p, b, at(2))

    expect(ordered(cadenceQueueKey(LINE))).toEqual([b.outboxId, c.outboxId])
  })

  it('peekTurn: quem está atrás da cabeça volta em ~meio segundo', async () => {
    const { cadence, enqueue } = makeSut()
    await enqueue()
    const b = await enqueue()

    expect(await cadence.peekTurn(LINE, b.outboxId, at(0))).toEqual({
      behind: true,
      retryAt: T0 + 500,
    })
  })

  it('peekTurn: a cabeça e o ticket fora da fila não estão atrás', async () => {
    const { cadence, enqueue } = makeSut()
    const a = await enqueue()

    expect(await cadence.peekTurn(LINE, a.outboxId, at(0))).toEqual({
      behind: false,
    })
    expect(await cadence.peekTurn(LINE, 'fora-da-fila', at(0))).toEqual({
      behind: false,
    })
  })

  it('peekTurn não mexe na fila', async () => {
    const { cadence, enqueue, ordered } = makeSut()
    const a = await enqueue()
    const b = await enqueue()

    await cadence.peekTurn(LINE, a.outboxId, at(0))
    await cadence.peekTurn(LINE, b.outboxId, at(0))
    await cadence.peekTurn(LINE, 'fora-da-fila', at(0))

    expect(ordered(cadenceQueueKey(LINE))).toEqual([a.outboxId, b.outboxId])
  })

  it('lista linhas e tickets para a varredura', async () => {
    const { cadence, enqueue } = makeSut()
    const a = await enqueue()

    expect(await cadence.queuedLines()).toEqual([LINE])
    expect(await cadence.queuedTickets(LINE)).toEqual([a.outboxId])
  })
})

describe('RedisSendCadence — concorrência', () => {
  it('duas reservas simultâneas na última vaga: exatamente uma é aceita', async () => {
    const { cadence, enqueue, hashes } = makeSut()
    const p = policy({ maxMessages: 20 })
    for (let i = 0; i < 19; i++) {
      await cadence.reserve(p, await enqueue(), at(i))
    }
    const a = await enqueue()
    const b = await enqueue()

    // A cabeça `a` vence; `b` chega junto e é a próxima: ou espera a vez, ou
    // encontra a janela cheia — nunca passa de 20.
    const [outA, outB] = await Promise.all([
      cadence.reserve(p, a, at(100)),
      cadence.reserve(p, b, at(100)),
    ])

    expect([outA.allowed, outB.allowed].filter(Boolean)).toHaveLength(1)
    expect(hashes.get(cadenceStateKey(LINE))?.count).toBe(20)
    if (!outB.allowed) expect(outB.retryAt).toBeGreaterThan(T0 + 100)

    // E, já sem ser questão de vez, a próxima tentativa encontra a janela cheia.
    expect(await cadence.reserve(p, b, at(200))).toMatchObject({
      allowed: false,
      reason: 'window-full',
      retryAt: T0 + MIN,
    })
  })
})

describe('RedisSendCadence — mensagens aguardando', () => {
  it('conta só quem ainda não recebeu vaga', async () => {
    const { cadence, enqueue } = makeSut()
    const a = await enqueue()
    await enqueue()
    await enqueue()

    await cadence.reserve(policy(), a, at(0))

    expect(await cadence.waitingCount(LINE)).toBe(2)
  })
})

describe('RedisSendCadence — ordem por destinatário (cadência desligada)', () => {
  const off = policy({ enabled: false })
  const makeRelaxed = () => makeSut({ fifoPerDestination: true })

  it('destinatários diferentes saem sem esperar uns pelos outros', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-b')
    const c = await enqueue('contato-c')

    expect((await cadence.reserve(off, c, at(0))).allowed).toBe(true)
    expect((await cadence.reserve(off, b, at(0))).allowed).toBe(true)
    expect((await cadence.reserve(off, a, at(0))).allowed).toBe(true)
  })

  it('o mesmo destinatário mantém a ordem, com outros no meio', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const texto = await enqueue('contato-a')
    await enqueue('contato-b')
    const anexo1 = await enqueue('contato-a')
    await enqueue('contato-c')
    const anexo2 = await enqueue('contato-a')

    expect(await cadence.reserve(off, anexo2, at(0))).toMatchObject({
      allowed: false,
      reason: 'not-head',
    })
    expect(await cadence.reserve(off, anexo1, at(0))).toMatchObject({
      allowed: false,
      reason: 'not-head',
    })
    expect((await cadence.reserve(off, texto, at(0))).allowed).toBe(true)
    expect((await cadence.reserve(off, anexo1, at(1))).allowed).toBe(true)
    expect((await cadence.reserve(off, anexo2, at(2))).allowed).toBe(true)
  })

  it('a ordem vale entre origens: quem entrou antes sai antes', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const bot = await enqueue('contato-a')
    const operador = await enqueue('contato-a')

    expect((await cadence.reserve(off, operador, at(0))).allowed).toBe(false)
    expect((await cadence.reserve(off, bot, at(0))).allowed).toBe(true)
    expect((await cadence.reserve(off, operador, at(1))).allowed).toBe(true)
  })

  it('com a chave desligada, a ordem é a da linha em todos os casos', async () => {
    const { cadence, enqueue } = makeSut({ fifoPerDestination: false })
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-b')

    expect((await cadence.reserve(off, b, at(0))).allowed).toBe(false)
    expect((await cadence.reserve(off, a, at(0))).allowed).toBe(true)
  })

  it('cadência ativada segue a ordem da linha, mesmo com a chave ligada', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-b')

    expect((await cadence.reserve(policy(), b, at(0))).allowed).toBe(false)
    expect((await cadence.reserve(policy(), a, at(0))).allowed).toBe(true)
  })

  it('janela aberta depois de desativar mantém a ordem da linha até o fim', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const p = policy({ maxMessages: 5 })
    await cadence.reserve(p, await enqueue('contato-x'), at(0))
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-b')

    // Desativada no meio da janela: b não passa na frente de a.
    expect((await cadence.reserve(off, b, at(1_000))).allowed).toBe(false)
    expect((await cadence.reserve(off, a, at(1_000))).allowed).toBe(true)
    expect((await cadence.reserve(off, b, at(1_001))).allowed).toBe(true)

    // Passada a janela, volta o relaxamento.
    const c = await enqueue('contato-c')
    const d = await enqueue('contato-d')
    expect((await cadence.reserve(off, d, at(2 * MIN))).allowed).toBe(true)
    expect((await cadence.reserve(off, c, at(2 * MIN))).allowed).toBe(true)
  })

  it('pausa vigente mantém a ordem da linha e nega a todos', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const p = policy({ maxMessages: 1, pauseMs: 5 * MIN })
    await cadence.reserve(p, await enqueue('contato-x'), at(0))
    const a = await enqueue('contato-a')

    expect(await cadence.reserve(off, a, at(1_000))).toMatchObject({
      allowed: false,
      reason: 'paused',
    })
  })

  it('ativar a cadência volta à ordem da linha para o que sobrou', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-b')
    const c = await enqueue('contato-c')

    expect((await cadence.reserve(off, b, at(0))).allowed).toBe(true)

    // Cadência ativada: c não passa na frente de a.
    expect((await cadence.reserve(policy(), c, at(1))).allowed).toBe(false)
    expect((await cadence.reserve(policy(), a, at(1))).allowed).toBe(true)
    expect((await cadence.reserve(policy(), c, at(2))).allowed).toBe(true)
  })

  it('o ticket devolvido após falha volta à posição original, antes de quem entrou depois', async () => {
    const { cadence, enqueue, ordered } = makeRelaxed()
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-a')

    // Redis perdeu o ticket de a; ele volta pelo seq gravado e o destino do ticket.
    await cadence.dequeue(LINE, a.outboxId)
    expect(ordered(cadenceDestKey(LINE, 'contato-a'))).toEqual([b.outboxId])

    expect((await cadence.reserve(off, a, at(0))).allowed).toBe(true)
    expect(ordered(cadenceDestKey(LINE, 'contato-a'))).toEqual([b.outboxId])
    expect((await cadence.reserve(off, b, at(1))).allowed).toBe(true)
  })

  it('o ticket aparece na fila da linha, na do destinatário e no mapa', async () => {
    const { enqueue, ordered, destMaps } = makeRelaxed()
    const a = await enqueue('contato-a')

    expect(ordered(cadenceQueueKey(LINE))).toEqual([a.outboxId])
    expect(ordered(cadenceDestKey(LINE, 'contato-a'))).toEqual([a.outboxId])
    expect(destMaps.get(cadenceTicketDestKey(LINE))?.get(a.outboxId)).toBe(
      'contato-a',
    )
  })

  it('concedida a vaga, o ticket sai das três estruturas', async () => {
    const { cadence, enqueue, ordered, destMaps } = makeRelaxed()
    const a = await enqueue('contato-a')

    await cadence.reserve(off, a, at(0))

    expect(ordered(cadenceQueueKey(LINE))).toEqual([])
    expect(ordered(cadenceDestKey(LINE, 'contato-a'))).toEqual([])
    expect(destMaps.get(cadenceTicketDestKey(LINE))?.has(a.outboxId)).toBe(
      false,
    )
  })

  it('dequeue limpa as três estruturas lendo o destino no mapa', async () => {
    const { cadence, enqueue, ordered, destMaps } = makeRelaxed()
    const a = await enqueue('contato-a')

    // A varredura de órfãos chama o dequeue sem a row: só o outboxId.
    await cadence.dequeue(LINE, a.outboxId)

    expect(ordered(cadenceQueueKey(LINE))).toEqual([])
    expect(ordered(cadenceDestKey(LINE, 'contato-a'))).toEqual([])
    expect(destMaps.get(cadenceTicketDestKey(LINE))?.has(a.outboxId)).toBe(
      false,
    )
  })

  it('a fila por destinatário não vira linha na varredura', async () => {
    const { cadence, enqueue } = makeRelaxed()
    await enqueue('contato-a')

    expect(await cadence.queuedLines()).toEqual([LINE])
  })

  it('peekTurn por destinatário: só está atrás quem tem outro à frente do mesmo contato', async () => {
    const { cadence, enqueue } = makeRelaxed()
    const a = await enqueue('contato-a')
    const b = await enqueue('contato-b')
    const a2 = await enqueue('contato-a')

    expect(await cadence.peekTurn(LINE, b.outboxId, at(0), true)).toEqual({
      behind: false,
    })
    expect(await cadence.peekTurn(LINE, a2.outboxId, at(0), true)).toEqual({
      behind: true,
      retryAt: T0 + 500,
    })
    expect(await cadence.peekTurn(LINE, a.outboxId, at(0), true)).toEqual({
      behind: false,
    })
  })

  it('peekTurn por linha (ou chave desligada) compara com a cabeça da linha', async () => {
    const relaxed = makeRelaxed()
    await relaxed.enqueue('contato-a')
    const b = await relaxed.enqueue('contato-b')
    expect(await relaxed.cadence.peekTurn(LINE, b.outboxId, at(0))).toEqual({
      behind: true,
      retryAt: T0 + 500,
    })

    const legacy = makeSut({ fifoPerDestination: false })
    await legacy.enqueue('contato-a')
    const lb = await legacy.enqueue('contato-b')
    expect(
      await legacy.cadence.peekTurn(LINE, lb.outboxId, at(0), true),
    ).toEqual({ behind: true, retryAt: T0 + 500 })
  })

  it('peekTurn: ticket sem destino registrado segue a ordem da linha', async () => {
    const { cadence, enqueue } = makeRelaxed()
    await enqueue('')
    const b = await enqueue('')

    expect(await cadence.peekTurn(LINE, b.outboxId, at(0), true)).toEqual({
      behind: true,
      retryAt: T0 + 500,
    })
  })
})
