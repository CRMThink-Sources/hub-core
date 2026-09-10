import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { BotFlowBot } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-bot.repository'
import { ensureBotFlowBot } from './ensure-bot-flow-bot'

const APP = 'app-1'
const HOOK = 'https://tunel.example/bitrix/bot'

const gravado = (over: Partial<BotFlowBot> = {}): BotFlowBot => ({
  appId: APP,
  bitrixBotId: 42,
  botToken: 'token-guardado',
  webhookUrl: HOOK,
  ...over,
})

const ESCOPOS_OK = ['crm', 'im', 'imbot', 'imopenlines']

function setup(opts: {
  existing?: BotFlowBot | null
  callMethod?: ReturnType<typeof vi.fn>
  /** Escopos do app no portal; o registro os checa antes de criar o bot. */
  scopes?: string[]
}) {
  // Por método: o registro consulta `scope` antes, e uma resposta única serviria a
  // checagem de escopo com o corpo do registro.
  const callMethod =
    opts.callMethod ??
    vi
      .fn()
      .mockImplementation((method: string) =>
        Promise.resolve(
          method === 'scope'
            ? (opts.scopes ?? ESCOPOS_OK)
            : { result: { bot: { id: 99 } } },
        ),
      )
  const save = vi.fn().mockImplementation((input: BotFlowBot) => input)

  return {
    client: { callMethod } as unknown as BitrixClient,
    repos: {
      get: { getByAppId: vi.fn().mockResolvedValue(opts.existing ?? null) },
      save: { save },
    },
    callMethod,
    save,
    /** As chamadas sem a de `scope`, que é diagnóstico e não parte do registro. */
    chamadasBitrix: () =>
      callMethod.mock.calls.filter(([method]) => method !== 'scope'),
  }
}

describe('ensureBotFlowBot', () => {
  it('registra na primeira vez e grava o que voltou', async () => {
    const { client, repos, save, chamadasBitrix } = setup({})

    const bot = await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
    })

    expect(chamadasBitrix()).toHaveLength(1)
    const [metodo, params] = chamadasBitrix()[0] as [
      string,
      { fields: Record<string, unknown> },
    ]
    expect(metodo).toBe('imbot.v2.Bot.register')
    expect(params.fields.type).toBe('openline')
    expect(params.fields.eventMode).toBe('webhook')
    expect(params.fields.webhookUrl).toBe(HOOK)

    expect(bot.bitrixBotId).toBe(99)
    expect(save).toHaveBeenCalledOnce()
  })

  it('manda o botToken no registro — é entrada, não retorno', async () => {
    // O chamador escolhe o token e a resposta não o devolve: esperar recebê-lo de volta
    // deixaria `transfer`/`finish` sem `CLIENT_ID`.
    const { client, repos, chamadasBitrix } = setup({})

    const bot = await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
    })

    const [, params] = chamadasBitrix()[0] as [
      string,
      { fields: { botToken?: string } },
    ]

    expect(params.fields.botToken).toBeTruthy()
    // O gravado é o mesmo que foi enviado: senão as chamadas seguintes não autorizam.
    expect(bot.botToken).toBe(params.fields.botToken)
  })

  it('token é único por registro', async () => {
    const a = setup({})
    const b = setup({})

    const um = await ensureBotFlowBot(a.client, a.repos, {
      appId: APP,
      webhookUrl: HOOK,
    })
    const dois = await ensureBotFlowBot(b.client, b.repos, {
      appId: 'app-2',
      webhookUrl: HOOK,
    })

    expect(um.botToken).not.toBe(dois.botToken)
    expect(um.botToken).toHaveLength(64)
  })

  it('bot já gravado com o mesmo webhook não chama o portal', async () => {
    const { client, repos, callMethod } = setup({ existing: gravado() })

    const bot = await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
    })

    expect(callMethod).not.toHaveBeenCalled()
    expect(bot.botToken).toBe('token-guardado')
  })

  it('webhook diferente dispara update, não novo registro', async () => {
    const { client, repos, callMethod, save } = setup({
      existing: gravado({ webhookUrl: 'https://antigo.example/hook' }),
    })

    const bot = await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
    })

    const [metodo, params] = callMethod.mock.calls[0] as [
      string,
      { botId: number; botToken: string; fields: { webhookUrl: string } },
    ]
    expect(metodo).toBe('imbot.v2.Bot.update')
    expect(params.botId).toBe(42)
    // Token antigo, nunca um novo: trocá-lo invalidaria as chamadas seguintes.
    expect(params.botToken).toBe('token-guardado')
    expect(params.fields.webhookUrl).toBe(HOOK)

    expect(bot.webhookUrl).toBe(HOOK)
    expect(bot.botToken).toBe('token-guardado')
    expect(save).toHaveBeenCalledOnce()
  })

  it('registro sem bot.id não grava nada', async () => {
    const { client, repos, save } = setup({
      callMethod: vi.fn().mockResolvedValue({ result: {} }),
    })

    await expect(
      ensureBotFlowBot(client, repos, { appId: APP, webhookUrl: HOOK }),
    ).rejects.toThrow()

    // Gravar id 0 deixaria `WELCOME_BOT_ID: 0` na linha.
    expect(save).not.toHaveBeenCalled()
  })
})

describe('nome do bot no portal', () => {
  it('registra com o nome do fluxo prefixado', async () => {
    const { client, repos, chamadasBitrix } = setup({})

    await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
      flowName: 'Atendimento comercial',
    })

    const [, params] = chamadasBitrix()[0] as [
      string,
      { fields: { properties: { name: string } } },
    ]
    expect(params.fields.properties.name).toBe(
      '[ThinkBot] Atendimento comercial',
    )
  })

  it('sem nome de fluxo cai no rótulo do app', async () => {
    const { client, repos, chamadasBitrix } = setup({})

    await ensureBotFlowBot(client, repos, { appId: APP, webhookUrl: HOOK })

    const [, params] = chamadasBitrix()[0] as [
      string,
      { fields: { properties: { name: string } } },
    ]
    expect(params.fields.properties.name).toBe('ThinkBot')
  })

  it('bot existente é renomeado sem trocar o webhook', async () => {
    // Renomear o fluxo não muda o endereço: mandar `webhookUrl` junto reescreveria um
    // campo que ninguém pediu para mexer.
    const { client, repos, callMethod, save } = setup({ existing: gravado() })

    await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
      flowName: 'Suporte N1',
    })

    const [metodo, params] = callMethod.mock.calls[0] as [
      string,
      { fields: Record<string, unknown> },
    ]
    expect(metodo).toBe('imbot.v2.Bot.update')
    expect(params.fields).toEqual({
      properties: { name: '[ThinkBot] Suporte N1' },
    })

    // Nada mudou no nosso lado: o nome vive no portal, não na nossa tabela.
    expect(save).not.toHaveBeenCalled()
  })

  it('webhook e nome mudando vão na mesma chamada', async () => {
    const { client, repos, callMethod } = setup({
      existing: gravado({ webhookUrl: 'https://antigo.example/hook' }),
    })

    await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
      flowName: 'Comercial',
    })

    expect(callMethod).toHaveBeenCalledOnce()
    const [, params] = callMethod.mock.calls[0] as [
      string,
      { fields: { webhookUrl: string; properties: { name: string } } },
    ]
    expect(params.fields.webhookUrl).toBe(HOOK)
    expect(params.fields.properties.name).toBe('[ThinkBot] Comercial')
  })

  it('nome só de espaços não vira prefixo solto', async () => {
    const { client, repos, chamadasBitrix } = setup({})

    await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
      flowName: '   ',
    })

    const [, params] = chamadasBitrix()[0] as [
      string,
      { fields: { properties: { name: string } } },
    ]
    expect(params.fields.properties.name).toBe('ThinkBot')
  })
})

describe('escopos antes do registro', () => {
  it('sem imbot não tenta registrar', async () => {
    // Registrar sem o escopo volta `ACCESS_DENIED` genérico, que manda o suporte
    // investigar canal aberto e bot em vez da permissão do app.
    const { client, repos, save, chamadasBitrix } = setup({
      scopes: ['crm', 'im', 'imopenlines'],
    })

    await expect(
      ensureBotFlowBot(client, repos, { appId: APP, webhookUrl: HOOK }),
    ).rejects.toThrow(/permiss|escopo/i)

    expect(chamadasBitrix()).toHaveLength(0)
    expect(save).not.toHaveBeenCalled()
  })

  it('sem imopenlines também barra: o bot não falaria', async () => {
    const { client, repos, chamadasBitrix } = setup({
      scopes: ['crm', 'im', 'imbot'],
    })

    await expect(
      ensureBotFlowBot(client, repos, { appId: APP, webhookUrl: HOOK }),
    ).rejects.toThrow()

    expect(chamadasBitrix()).toHaveLength(0)
  })

  it('bot já gravado não paga a consulta de escopo', async () => {
    // O bot existir já prova que o escopo estava lá; consultar em cada vínculo custaria
    // uma chamada para não descobrir nada.
    const { client, repos, callMethod } = setup({ existing: gravado() })

    await ensureBotFlowBot(client, repos, { appId: APP, webhookUrl: HOOK })

    expect(callMethod).not.toHaveBeenCalled()
  })

  it('consulta de escopo que falha não impede o registro', async () => {
    const callMethod = vi
      .fn()
      .mockImplementation((method: string) =>
        method === 'scope'
          ? Promise.reject(new Error('QUERY_LIMIT_EXCEEDED'))
          : Promise.resolve({ result: { bot: { id: 99 } } }),
      )
    const { client, repos } = setup({ callMethod })

    const bot = await ensureBotFlowBot(client, repos, {
      appId: APP,
      webhookUrl: HOOK,
    })

    expect(bot.bitrixBotId).toBe(99)
  })
})
