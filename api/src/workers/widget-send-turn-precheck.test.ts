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

function makeSut() {
  const fake = fakeCadenceRedis()
  // random fixo: o retry de quem está atrás fica previsível (500 ms).
  const cadence = new RedisSendCadence(fake.redis, () => 0)
  const lineKeys = new LineKeyMemory()
  lineKeys.remember(ITEM, LINE)

  const rowOf = async (
    id: string,
    over: Partial<TurnPrecheckRow> = {},
  ): Promise<TurnPrecheckRow> => ({
    id,
    subscriptionItemId: ITEM,
    status: 'PENDING',
    queueSeq: await cadence.enqueue(LINE, id),
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
