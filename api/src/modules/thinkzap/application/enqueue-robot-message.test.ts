import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { EnqueueRobotMessage } from './enqueue-robot-message'
import type { RobotFileResult } from './robot-files/fetch-robot-files'

const item: SubscriptionItem = {
  id: 'i1',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
  metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1', zApiInstanceToken: 't' },
}

const file = (
  id: string,
  kind: 'image' | 'audio' | 'document',
  name: string,
): RobotFileResult => ({
  status: 'ok',
  id,
  name,
  mime: 'x/y',
  kind,
  dataUrl: `data:x/y;base64,${Buffer.from(id).toString('base64')}`,
})

function makeSut() {
  let n = 0
  const storage = {
    store: vi.fn(() => Promise.resolve({ key: `k-${++n}` })),
    load: vi.fn(),
    remove: vi.fn(),
  }
  const outbox = {
    createParts: vi.fn((inputs: object[]) =>
      Promise.resolve(
        inputs.map((input, i) => ({ ...input, id: `r-${i}`, queueSeq: null })),
      ),
    ),
    setQueueSeq: vi.fn(async () => {}),
  }
  const sendQueue = { enqueue: vi.fn(async () => {}) }
  const instances = {
    getInstanceByInstanceId: vi
      .fn()
      .mockResolvedValue({ id: 'inst-db-1', instanceId: 'Z-1' }),
    create: vi.fn(),
  }
  const sut = new EnqueueRobotMessage({
    storage,
    outbox: outbox as never,
    sendQueue,
    cadence: null,
    instances: instances as never,
  })
  const run = (over: Partial<Parameters<typeof sut.execute>[0]> = {}) =>
    sut.execute({
      item,
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      workflowId: 'wf-1',
      message: 'Segue sua proposta',
      files: [],
      requestedFiles: 0,
      recipients: ['5511999990000', '5511999990001'],
      fromPhone: '5511911111111',
      crmDocument: { entity: 'DEAL', entityId: '10' },
      ...over,
    })
  const parts = () =>
    outbox.createParts.mock.calls[0]![0] as Record<string, unknown>[]
  return { run, parts, storage, outbox, sendQueue }
}

describe('EnqueueRobotMessage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('partes por destinatário, em ordem, com a legenda no primeiro arquivo', async () => {
    const s = makeSut()

    await s.run({
      files: [
        file('1', 'document', 'proposta.pdf'),
        file('2', 'image', 'anexo.png'),
      ],
      requestedFiles: 2,
    })

    expect(
      s
        .parts()
        .map(p => [
          p.destination,
          p.kind,
          p.fileName ?? null,
          p.caption ?? null,
        ]),
    ).toEqual([
      ['5511999990000', 'MEDIA', 'proposta.pdf', 'Segue sua proposta'],
      ['5511999990000', 'MEDIA', 'anexo.png', null],
      ['5511999990001', 'MEDIA', 'proposta.pdf', 'Segue sua proposta'],
      ['5511999990001', 'MEDIA', 'anexo.png', null],
    ])
    // Um arquivo guardado uma vez, para todos os destinatários.
    expect(s.storage.store).toHaveBeenCalledTimes(2)
    expect(s.parts()[0]!.mediaSource).toEqual(s.parts()[2]!.mediaSource)
    expect(s.parts().every(p => p.origin === 'ROBOT_MESSAGE')).toBe(true)
    expect(s.parts()[0]).toMatchObject({
      partIndex: 0,
      entity: 'DEAL',
      entityId: '10',
      dispatchMeta: {
        kind: 'robot-message',
        recipients: ['5511999990000', '5511999990001'],
        requestedFiles: 2,
      },
    })
    expect(s.sendQueue.enqueue).toHaveBeenCalledTimes(4)
  })

  it('primeiro arquivo áudio: o texto sai antes, como mensagem separada', async () => {
    const s = makeSut()

    await s.run({
      files: [file('1', 'audio', 'voz.ogg')],
      requestedFiles: 1,
      recipients: ['5511999990000'],
    })

    expect(s.parts().map(p => [p.kind, p.text])).toEqual([
      ['TEXT', 'Segue sua proposta'],
      ['MEDIA', ''],
    ])
  })

  it('arquivo descartado antes do envio vai para o grupo, não para a fila', async () => {
    const s = makeSut()

    await s.run({
      message: '',
      files: [
        file('1', 'document', 'ok.pdf'),
        { status: 'failed', id: '2', name: 'grande.mp4', reason: 'too_large' },
      ],
      requestedFiles: 2,
      recipients: ['5511999990000'],
    })

    expect(s.parts()).toHaveLength(1)
    expect(s.parts()[0]!.dispatchMeta).toMatchObject({
      failedFiles: [{ name: 'grande.mp4', reason: 'too_large' }],
    })
  })

  it('só texto: uma parte por destinatário', async () => {
    const s = makeSut()

    expect(await s.run()).toEqual({ queued: 2 })
    expect(s.parts().map(p => p.kind)).toEqual(['TEXT', 'TEXT'])
  })
})
