import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessageMock = vi.fn().mockResolvedValue({ ok: true })
const getLastMessageIdMock = vi.fn().mockResolvedValue(null)

vi.mock('@/shared/infra/clients/bitrix.client', () => {
  class BitrixClient {
    sendMessage = sendMessageMock
    getLastMessageId = getLastMessageIdMock
  }
  return { BitrixClient }
})

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'thinkzap' } },
    // A resolução da linha pelo item usa o appCode para escopar a instalação.
    appCodes: { thinkzap: 'crmthink.thinkzap' },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({ PrismaThinkzapMessageRepository: vi.fn() }),
)

import { ProcessHubMessageInboundMessageUseCase } from './process-hubmessage-inbound-message.use-case'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type { ISendMessageData } from '@/shared/infra/clients/bitrix.client'

const CHANNEL_ID = '019F5CC904597D81817829E11B7679F2'

const baseInstance = {
  id: 'instance-db-1',
  instanceId: CHANNEL_ID,
  channelId: CHANNEL_ID,
  vinculatedChannel: '12',
  domainId: 'domain-1',
}

/**
 * A linha vem do item de assinatura. `Connector` saiu: servia para o guard de
 * provider e para `appId`, e o item dá os dois — declarando o provider por qual
 * par de credencial está preenchido.
 */
const baseItem = {
  id: 'i1',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active' as const,
  settings: {},
  vinculatedChannel: '12',
  metadata: {
    provider: ConnectorProvider.HUBMESSAGE,
    hubmessageChannelId: CHANNEL_ID,
    wabaId: 'W-9',
  },
}

function makeMessage(
  overrides: Partial<HubMessageWebhookMessage> = {},
): HubMessageWebhookMessage {
  return {
    _id: '019F5D201EAA795BA7B46A820C7CA289',
    channel_id: CHANNEL_ID,
    // Contém o número do NOSSO WABA, não o do contato — nunca deve virar chat.id.
    chat_id: `${CHANNEL_ID}=15553840789`,
    created: 1783973813930,
    metadata: { from_me: false, moment: 1783973812000 },
    sender: { identifier: '554792259475', name: 'Romuca' },
    recipient: { identifier: '15553840789' },
    contents: [{ type: 'TEXT', message: 'Outra msg de teste' }],
    attachments: [],
    ...overrides,
  }
}

function buildUseCase({
  instance = baseInstance,
  item = baseItem,
  repoFind,
  repoCreate,
  subscriptionStatus = 'active',
  currentPeriodEnd = new Date('2099-01-01T00:00:00.000Z'),
  domain = { id: 'domain-1', name: 'acme.bitrix24.com.br' },
}: {
  instance?: unknown
  item?: unknown
  repoFind?: ReturnType<typeof vi.fn>
  repoCreate?: ReturnType<typeof vi.fn>
  subscriptionStatus?: string
  currentPeriodEnd?: Date
  domain?: unknown
} = {}) {
  const messageRepo = {
    findByProviderMessageId: repoFind ?? vi.fn().mockResolvedValue(null),
    create: repoCreate ?? vi.fn().mockResolvedValue(undefined),
  }

  /** Ver a nota equivalente no teste do caminho Z-API. */
  const disconnectExpiredLine = { schedule: vi.fn() }

  /**
   * Coletor da **aba Logs** do job. É onde o suporte procura "por que esta mensagem
   * não chegou": os três descartes deste fluxo encerram o job em `completed`, então
   * sem linha na aba eles são indistinguíveis de uma entrega.
   */
  const lines: string[] = []
  const jobLog = {
    appendJobLog: (line: string) => {
      lines.push(line)
      return Promise.resolve()
    },
  }

  const getDomainById = vi.fn().mockResolvedValue(domain)

  const useCase = new ProcessHubMessageInboundMessageUseCase(
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1', name: 'acme' },
        aplication: { id: 'app-1', spaId: '42' },
        // Assinatura ativa: sem `status`, o entitlement cai em `inactive` e a
        // mensagem é descartada antes de qualquer efeito.
        subscriptions: [
          {
            id: 'sub-1',
            status: subscriptionStatus,
            currentPeriodEnd,
            items: item ? [item] : [],
          },
        ],
      }),
    } as never,
    {
      getInstanceByChannelId: vi.fn().mockResolvedValue(instance),
    } as never,
    { getDomainById } as never,
    {
      getById: vi.fn().mockResolvedValue({ id: 'app-1' }),
      getByAppCodeAndDomainId: vi.fn().mockResolvedValue({ id: 'app-1' }),
    } as never,
    { get: vi.fn().mockResolvedValue({ id: 'cred-1' }) } as never,
    messageRepo as never,
    disconnectExpiredLine as never,
  )

  /** Todo `execute` do teste passa pelo coletor; `useCase` fica exposto para o caso sem contexto. */
  const run = (message: HubMessageWebhookMessage) =>
    useCase.execute(message, jobLog)

  return {
    useCase,
    run,
    lines,
    getDomainById,
    messageRepo,
    disconnectExpiredLine,
  }
}

/** A aba tem que nomear o portal — `domainId` é uuid e não serve para abrir o CRM. */
function expectNamesDomain(lines: string[]): void {
  expect(lines.some(line => line.includes('acme.bitrix24.com.br'))).toBe(true)
}

function sentPayload(callIndex = 0): ISendMessageData {
  return sendMessageMock.mock.calls[callIndex]?.[0] as ISendMessageData
}

describe('ProcessHubMessageInboundMessageUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMessageMock.mockResolvedValue({ ok: true })
    getLastMessageIdMock.mockResolvedValue(null)
  })

  /**
   * Trial vencido: descarta **antes** de persistir. Mensagem de linha bloqueada não
   * deve virar row em `messages` nem aparecer no CRM.
   */
  it('discards the message when the trial has expired', async () => {
    const { run, messageRepo, lines } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await run(makeMessage())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()

    /**
     * O descarte encerra o job em `completed`. Sem esta linha a aba fica idêntica à
     * de um job que entregou, que é o que deixava "a mensagem não entrou no canal
     * aberto" sem resposta.
     */
    const discard = lines.find(line => line.includes('DESCARTADA'))
    expect(discard).toContain('sem assinatura ativa')
    expect(discard).toContain('trial-expired')
    expect(discard).toContain('item=i1')
    expectNamesDomain(lines)
  })

  it('discards the message when the subscription is cancelled', async () => {
    const { run, messageRepo } = buildUseCase({
      subscriptionStatus: 'cancelled',
    })

    await run(makeMessage())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  /** Mesmo papel do caminho Z-API: mensagem chegando prova canal ainda vivo. */
  it('agenda a desconexão do canal quando o trial venceu', async () => {
    const { run, disconnectExpiredLine } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await run(makeMessage())

    expect(disconnectExpiredLine.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      'trial-expired',
    )
  })

  it('não agenda desconexão para linha habilitada', async () => {
    const { run, disconnectExpiredLine } = buildUseCase()

    await run(makeMessage())

    expect(disconnectExpiredLine.schedule).not.toHaveBeenCalled()
  })

  /**
   * Descarte não é erro para o provider: exceção aqui vira retry no worker, e a
   * HubMessage reentregaria indefinidamente uma mensagem que nunca vai ser aceita.
   */
  it('does not throw when discarding — the provider must not retry', async () => {
    const { run } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await expect(run(makeMessage())).resolves.toBeUndefined()
  })

  /** Trial dentro da janela funciona igual a assinatura paga. */
  it('processes normally while the trial window is open', async () => {
    const { run } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    })

    await run(makeMessage())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it('sends text to the open channel keyed by the contact phone, not by chat_id', async () => {
    const { run } = buildUseCase()

    await run(makeMessage())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const payload = sentPayload()

    expect(payload.CONNECTOR).toBe('thinkzap')
    expect(payload.LINE).toBe(12)

    const sent = payload.MESSAGES[0]!
    // Identidade = identifier canonizado. A HubMessage entrega celular BR sem o 9o
    // digito e o envio pelo widget identifica o contato com ele; enquanto o cru era
    // a identidade, o contato iniciado pelo CRM ganhava um segundo canal aberto ao
    // responder.
    expect(sent.chat.id).toBe('5547992259475')
    expect(sent.user.id).toBe('5547992259475')
    expect(sent.user.phone).toBe('5547992259475')
    expect(sent.chat.id).not.toContain('15553840789')
    expect(sent.chat.id).not.toContain(CHANNEL_ID)
    expect(sent.message.id).toBe('019F5D201EAA795BA7B46A820C7CA289')
    expect(sent.message.text).toBe('Outra msg de teste')
    expect(sent.message.date).toBe(new Date(1783973812000).toISOString())
  })

  it('reuses the same chat id for two messages of the same contact', async () => {
    const { run } = buildUseCase()

    await run(makeMessage({ _id: 'MSG-A' }))
    await run(makeMessage({ _id: 'MSG-B' }))

    expect(sentPayload(0).MESSAGES[0]!.chat.id).toBe('5547992259475')
    expect(sentPayload(1).MESSAGES[0]!.chat.id).toBe('5547992259475')
  })

  it('gives distinct chat ids to distinct contacts sharing the same chat_id', async () => {
    const { run } = buildUseCase()

    await run(makeMessage({ _id: 'MSG-A' }))
    await run(
      makeMessage({
        _id: 'MSG-B',
        sender: { identifier: '5511999998888', name: 'Outro' },
      }),
    )

    expect(sentPayload(0).MESSAGES[0]!.chat.id).toBe('5547992259475')
    expect(sentPayload(1).MESSAGES[0]!.chat.id).toBe('5511999998888')
  })

  /**
   * O guard de provider virou consequência da busca: `findLineItemByChannelId`
   * filtra por `HUBMESSAGE`, então uma linha Z-API que use esse id nunca
   * corresponde. Mesma proteção, um caminho a menos.
   */
  it('refuses to process when no HUBMESSAGE line owns the channel', async () => {
    const { run, lines } = buildUseCase({
      item: {
        ...baseItem,
        metadata: {
          provider: ConnectorProvider.ZAPI,
          zApiInstanceId: CHANNEL_ID,
          zApiInstanceToken: 'tok',
        },
      },
    })

    await expect(run(makeMessage())).rejects.toThrow(/HUBMESSAGE/)
    expect(sendMessageMock).not.toHaveBeenCalled()

    // Recusa, não descarte: a linha tem que dizer que o job falha e que retentar
    // não resolve — o conserto é no CRM.
    const refusal = lines.find(line => line.includes('Nenhuma linha'))
    expect(refusal).toContain('Job vai falhar')
    expect(refusal).toContain('retentativa cai no mesmo lugar')
    expectNamesDomain(lines)
  })

  it('skips sending when the message id was already delivered', async () => {
    const repoFind = vi.fn().mockResolvedValue({
      id: 'msg-db-1',
      providerMessageId: '019F5D201EAA795BA7B46A820C7CA289',
    })
    const { run, messageRepo, lines } = buildUseCase({ repoFind })

    await run(makeMessage())

    expect(repoFind).toHaveBeenCalledWith(
      'instance-db-1',
      '019F5D201EAA795BA7B46A820C7CA289',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()

    const discard = lines.find(line => line.includes('DESCARTADA'))
    expect(discard).toContain('já foi entregue ao canal aberto')
    expect(discard).toContain('reentrega')
    expectNamesDomain(lines)
  })

  it('throws when the channel is unknown', async () => {
    const { run, lines } = buildUseCase({ instance: null })

    await expect(run(makeMessage())).rejects.toThrow(
      'Instance not found for HubMessage channel',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()

    // Único desvio sem domínio na aba: ele vem da instância, que é justamente o
    // que não resolveu. A linha nomeia a chave recebida em vez disso.
    const refusal = lines.find(line =>
      line.includes('Instância não encontrada'),
    )
    expect(refusal).toContain(CHANNEL_ID)
    expect(refusal).toContain('Job vai falhar')
  })

  it('throws when the instance has no vinculated channel', async () => {
    const { run, lines } = buildUseCase({
      item: { ...baseItem, vinculatedChannel: null },
    })

    await expect(run(makeMessage())).rejects.toThrow(
      'Instance has no vinculated channel',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()

    const refusal = lines.find(line => line.includes('sem canal aberto'))
    expect(refusal).toContain('ufCrm93Conector')
    expectNamesDomain(lines)
  })

  it('skips unsupported content without throwing', async () => {
    const { run, messageRepo, lines } = buildUseCase()

    await expect(
      run(
        makeMessage({
          contents: [{ type: 'ALGO_NOVO' } as never],
          attachments: [],
        }),
      ),
    ).resolves.toBeUndefined()

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()

    // Os tipos recebidos entram crus: é a única pista de qual conteúdo a HubMessage
    // mandou que o tradutor não conhece.
    const discard = lines.find(line => line.includes('DESCARTADA'))
    expect(discard).toContain('nenhum tipo de conteúdo suportado')
    expect(discard).toContain('ALGO_NOVO')
    expectNamesDomain(lines)
  })

  it('persists the snapshot with the bitrix chat id after sending', async () => {
    sendMessageMock.mockResolvedValue({
      result: { DATA: { RESULT: [{ session: { CHAT_ID: '1801' } }] } },
    })
    getLastMessageIdMock.mockResolvedValue('456')

    const { run, messageRepo } = buildUseCase()

    await run(makeMessage())

    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-db-1',
        source: 'HUBMESSAGE',
        providerMessageId: '019F5D201EAA795BA7B46A820C7CA289',
        bitrixChatId: '1801',
        bitrixMessageId: '456',
        chatId: '5547992259475',
        type: 'TEXT',
        text: 'Outra msg de teste',
      }),
    )
  })

  it('sends media as files with the caption as text', async () => {
    const { run } = buildUseCase()

    await run(
      makeMessage({
        contents: [],
        attachments: [
          {
            type: 'IMAGE',
            url: 'https://exemplo.com/imagem.png',
            caption: 'Confira',
          },
        ],
      }),
    )

    const sent = sentPayload().MESSAGES[0]!
    expect(sent.message.text).toBe('Confira')
    expect(sent.message.files).toEqual([
      { url: 'https://exemplo.com/imagem.png', name: 'Imagem' },
    ])
  })

  it('completes the job when persistence fails after a successful send', async () => {
    const repoCreate = vi.fn().mockRejectedValue(new Error('db down'))
    const { run, lines } = buildUseCase({ repoCreate })

    await expect(run(makeMessage())).resolves.toBeUndefined()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)

    // `completed` com a mensagem entregue e sem registro é decisão, não acidente:
    // retentar duplicaria a mensagem no CRM. A aba tem que dizer os dois.
    const outcome = lines.find(line => line.startsWith('Desfecho:'))
    expect(outcome).toContain('ENTREGUE')
    expect(outcome).toContain('persistência falhou')
    expect(outcome).toContain('db down')
  })

  it('escreve contexto, linha, payload, aceite e desfecho no caminho completo', async () => {
    sendMessageMock.mockResolvedValue({
      result: { DATA: { RESULT: [{ session: { CHAT_ID: '1801' } }] } },
    })
    getLastMessageIdMock.mockResolvedValue('456')

    const { run, lines } = buildUseCase()

    await run(makeMessage())

    const context = lines[0]!
    expect(context).toContain('Mensagem recebida')
    expect(context).toContain('acme.bitrix24.com.br')
    expect(context).toContain(CHANNEL_ID)
    expect(context).toContain('554792259475')
    expect(context).toContain('019F5D201EAA795BA7B46A820C7CA289')
    expect(context).toContain('conteúdo=TEXT')

    const resolved = lines.find(line => line.startsWith('Linha resolvida'))!
    expect(resolved).toContain('item=i1')
    expect(resolved).toContain('entitlement=active')
    expect(resolved).toContain('canal aberto=12')

    const sending = lines.find(line => line.startsWith('Entregando'))!
    expect(sending).toContain('CONNECTOR=thinkzap')
    expect(sending).toContain('LINE=12')
    expect(sending).toContain('chat.id=5547992259475')

    const accepted = lines.find(line => line.startsWith('Bitrix aceitou'))!
    expect(accepted).toContain('session.CHAT_ID=1801')
    expect(accepted).toContain('bitrixMessageId=456')

    expect(lines.at(-1)).toContain('ENTREGUE')
    expect(lines.at(-1)).toContain('registro persistido')

    /**
     * A aba é lida por quem dá suporte, não por quem é dono da conversa: tipo e
     * contagem de arquivos bastam para diagnosticar, e o texto do contato não entra.
     */
    expect(lines.some(line => line.includes('Outra msg de teste'))).toBe(false)
  })

  it('registra na aba quando o id real da mensagem no Bitrix não resolve', async () => {
    sendMessageMock.mockResolvedValue({
      result: { DATA: { RESULT: [{ session: { CHAT_ID: '1801' } }] } },
    })
    getLastMessageIdMock.mockResolvedValue(null)

    const { run, lines } = buildUseCase()

    await run(makeMessage())

    const accepted = lines.find(line => line.startsWith('Bitrix aceitou'))!
    expect(accepted).toContain('session.CHAT_ID=1801')
    expect(accepted).toContain('não resolvido')
  })

  /** O default `noopJobLog` é o que mantém chamada fora da fila funcionando. */
  it('roda sem contexto de job e sem escrever linha nenhuma', async () => {
    const { useCase, lines } = buildUseCase()

    await expect(useCase.execute(makeMessage())).resolves.toBeUndefined()

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(lines).toEqual([])
  })

  /**
   * A leitura tardia saiu quando o domínio subiu para o topo. Se voltar, o caminho
   * completo passa a ler `core_domains` duas vezes por mensagem.
   */
  it('lê o domínio uma única vez no caminho completo', async () => {
    const { run, getDomainById } = buildUseCase()

    await run(makeMessage())

    expect(getDomainById).toHaveBeenCalledTimes(1)
  })

  /**
   * Resolver o domínio antes dos desvios não pode transformar domínio ausente em
   * falha nova: o descarte por duplicata precede a instalação e nunca dependeu dele.
   */
  it('não antecipa falha quando o domínio não é encontrado', async () => {
    const repoFind = vi.fn().mockResolvedValue({ id: 'msg-db-1' })
    const { run, lines } = buildUseCase({ domain: null, repoFind })

    await expect(run(makeMessage())).resolves.toBeUndefined()

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(lines[0]).toContain('domínio=não resolvido')
    expect(lines.find(line => line.includes('DESCARTADA'))).toContain(
      'já foi entregue',
    )
  })
})
