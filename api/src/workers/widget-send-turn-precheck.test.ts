import { describe, expect, it, vi } from 'vitest'
import { RedisSendCadence } from '@/modules/thinkzap/infra/queue/redis-send-cadence'
import { fakeCadenceRedis } from '@/modules/thinkzap/infra/queue/redis-send-cadence.fake'
import {
  LineKeyMemory,
  precheckLineTurn,
  type TurnPrecheckRow,
} from './widget-send-turn-precheck'

const LINE = 'zapi-inst-1'
const ITEM = '77'
const NOW = new Date('2026-10-29T18:00:00.000Z')

function makeSut(
  opts: { cadenceEnabled?: boolean; fifoPerDestination?: boolean } = {},
) {
  const fake = fakeCadenceRedis()
  // random fixo: o retry de quem está atrás fica previsível (500 ms).
  const cadence = new RedisSendCadence(fake.redis, () => 0, {
    fifoPerDestination: opts.fifoPerDestination,
  })
  const lineKeys = new LineKeyMemory()
  lineKeys.remember(ITEM, LINE, opts.cadenceEnabled)

  const rowOf = async (
    id: string,
    over: Partial<TurnPrecheckRow> = {},
    destination = `dest-${id}`,
  ): Promise<TurnPrecheckRow> => ({
    id,
    subscriptionItemId: ITEM,
    status: 'PENDING',
    queueSeq: await cadence.enqueue(LINE, id, destination),
    providerMessageId: null,
    ...over,
  })

  const precheck = (row: TurnPrecheckRow) =>
    precheckLineTurn(row, { lineKeys, cadence, now: () => NOW })

  return { cadence, lineKeys, rowOf, precheck }
}

describe('precheckLineTurn', () => {
  it('atrás da cabeça: adia sem passar pelo despacho', async () => {
    const { rowOf, precheck } = makeSut()
    await rowOf('ob-1')
    const second = await rowOf('ob-2')

    expect(await precheck(second)).toEqual({
      deferUntil: NOW.getTime() + 500,
    })
  })

  it('a cabeça segue para o despacho completo', async () => {
    const { rowOf, precheck } = makeSut()
    const head = await rowOf('ob-1')
    await rowOf('ob-2')

    expect(await precheck(head)).toBeNull()
  })

  it('linha ainda não resolvida neste processo: segue para o despacho', async () => {
    const { rowOf, precheck } = makeSut()
    await rowOf('ob-1')
    const second = await rowOf('ob-2', { subscriptionItemId: 'outro-item' })

    expect(await precheck(second)).toBeNull()
  })

  it('row sem posição na fila: segue para o despacho', async () => {
    const { rowOf, precheck } = makeSut()
    await rowOf('ob-1')
    const second = await rowOf('ob-2', { queueSeq: null })

    expect(await precheck(second)).toBeNull()
  })

  it('row que não está PENDING ou já entregue: segue para o despacho', async () => {
    const { rowOf, precheck } = makeSut()
    await rowOf('ob-1')

    expect(
      await precheck(await rowOf('ob-2', { status: 'SENDING' })),
    ).toBeNull()
    expect(
      await precheck(await rowOf('ob-3', { providerMessageId: 'msg-1' })),
    ).toBeNull()
  })

  it('chave desatualizada (linha reprovisionada): segue para o despacho', async () => {
    const { rowOf, precheck, lineKeys } = makeSut()
    await rowOf('ob-1')
    const second = await rowOf('ob-2')
    lineKeys.remember(ITEM, 'zapi-inst-antiga')

    expect(await precheck(second)).toBeNull()
  })

  describe('linha sem cadência (ordem por destinatário)', () => {
    it('não adia quem é a cabeça do próprio destinatário', async () => {
      const { rowOf, precheck } = makeSut({
        cadenceEnabled: false,
        fifoPerDestination: true,
      })
      await rowOf('ob-1', {}, 'contato-a')
      const outro = await rowOf('ob-2', {}, 'contato-b')

      expect(await precheck(outro)).toBeNull()
    })

    it('adia quem tem outra mensagem do mesmo destinatário à frente', async () => {
      const { rowOf, precheck } = makeSut({
        cadenceEnabled: false,
        fifoPerDestination: true,
      })
      await rowOf('ob-1', {}, 'contato-a')
      await rowOf('ob-2', {}, 'contato-b')
      const segunda = await rowOf('ob-3', {}, 'contato-a')

      expect(await precheck(segunda)).toEqual({
        deferUntil: NOW.getTime() + 500,
      })
    })

    it('com a chave desligada, segue a ordem da linha como antes', async () => {
      const { rowOf, precheck } = makeSut({
        cadenceEnabled: false,
        fifoPerDestination: false,
      })
      await rowOf('ob-1', {}, 'contato-a')
      const outro = await rowOf('ob-2', {}, 'contato-b')

      expect(await precheck(outro)).toEqual({
        deferUntil: NOW.getTime() + 500,
      })
    })
  })

  it('linha com cadência adia pela ordem da linha, mesmo com a chave ligada', async () => {
    const { rowOf, precheck } = makeSut({
      cadenceEnabled: true,
      fifoPerDestination: true,
    })
    await rowOf('ob-1', {}, 'contato-a')
    const outro = await rowOf('ob-2', {}, 'contato-b')

    expect(await precheck(outro)).toEqual({ deferUntil: NOW.getTime() + 500 })
  })

  it('memória sem modo cai no comportamento atual (ordem da linha)', async () => {
    const { rowOf, precheck, lineKeys } = makeSut({ fifoPerDestination: true })
    await rowOf('ob-1', {}, 'contato-a')
    const outro = await rowOf('ob-2', {}, 'contato-b')
    lineKeys.remember(ITEM, LINE)

    expect(await precheck(outro)).toEqual({ deferUntil: NOW.getTime() + 500 })
  })

  it('Redis falhou na checagem: segue para o despacho', async () => {
    const lineKeys = new LineKeyMemory()
    lineKeys.remember(ITEM, LINE)
    const cadence = {
      peekTurn: vi.fn().mockRejectedValue(new Error('redis fora')),
    }

    const out = await precheckLineTurn(
      {
        id: 'ob-1',
        subscriptionItemId: ITEM,
        status: 'PENDING',
        queueSeq: 1,
        providerMessageId: null,
      },
      { lineKeys, cadence },
    )

    expect(out).toBeNull()
  })
})
