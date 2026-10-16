import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { BotFlowBot } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-bot.repository'
import type { BotFlowBindingWithFlow } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import { BitrixWelcomeBotAdapter } from './bitrix-welcome-bot.adapter'

const APP = 'app-1'

const bot: BotFlowBot = {
  appId: APP,
  flowId: 'f1',
  bitrixBotId: 42,
  botToken: 'token-1',
  webhookUrl: 'https://tunel.example/bot',
}

const vinculo = (): BotFlowBindingWithFlow =>
  ({
    id: 'b1',
    appId: APP,
    flowId: 'f1',
    flowName: 'Comercial',
    flowStatus: 'PUBLISHED',
    lineId: '7',
    priority: 100,
    active: true,
    condition: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as BotFlowBindingWithFlow

function setup(opts: {
  bot?: BotFlowBot | null
  bindings?: BotFlowBindingWithFlow[]
  callMethod?: ReturnType<typeof vi.fn>
}) {
  const callMethod =
    opts.callMethod ?? vi.fn().mockResolvedValue({ result: { result: true } })
  const del = vi.fn().mockResolvedValue(undefined)

  const adapter = new BitrixWelcomeBotAdapter(
    { callMethod } as unknown as BitrixClient,
    {
      get: { getByFlowId: vi.fn().mockResolvedValue(opts.bot ?? null) },
      list: { listByAppId: vi.fn().mockResolvedValue([]) },
      save: { save: vi.fn() },
      delete: { delete: del },
      bindings: {
        listByAppId: vi.fn().mockResolvedValue(opts.bindings ?? []),
      },
    },
  )

  return { adapter, callMethod, del }
}

// O bot atende todas as linhas do fluxo: desregistrá-lo com um
// canal ainda vinculado pararia aquele atendimento sem ninguém pedir.
describe('removeBotIfUnused', () => {
  it('desregistra quando nenhuma linha usa mais', async () => {
    const { adapter, callMethod, del } = setup({ bot, bindings: [] })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(callMethod).toHaveBeenCalledWith('imbot.v2.Bot.unregister', {
      botId: 42,
      // `botToken` obrigatório: o bot é `eventMode: 'webhook'`.
      botToken: 'token-1',
    })
    expect(del).toHaveBeenCalledWith(APP, 42)
  })

  it('NÃO desregistra com vínculo restante', async () => {
    const { adapter, callMethod, del } = setup({
      bot,
      bindings: [vinculo()],
    })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(callMethod).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('sem bot gravado não faz nada', async () => {
    const { adapter, callMethod } = setup({ bot: null })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(callMethod).not.toHaveBeenCalled()
  })

  it('aceita a forma plana da resposta', async () => {
    // A doc mostra `{ result: { result: true } }` mas descreve `result` como boolean.
    const { adapter, del } = setup({
      bot,
      bindings: [],
      callMethod: vi.fn().mockResolvedValue({ result: true }),
    })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(del).toHaveBeenCalledWith(APP, 42)
  })

  it('`result: false` NÃO apaga do banco', async () => {
    // `unregister` recusa sem lançar. Apagar o registro perderia o `botToken` de um bot
    // que continua no portal, e `Bot.list` não devolve token: ficaria inalcançável.
    const { adapter, del } = setup({
      bot,
      bindings: [],
      callMethod: vi.fn().mockResolvedValue({ result: { result: false } }),
    })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(del).not.toHaveBeenCalled()
  })

  it('resposta inesperada é tratada como recusa', async () => {
    const { adapter, del } = setup({
      bot,
      bindings: [],
      callMethod: vi.fn().mockResolvedValue({}),
    })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(del).not.toHaveBeenCalled()
  })

  it('desregistra antes de apagar, nunca o contrário', async () => {
    const ordem: string[] = []
    const callMethod = vi.fn().mockImplementation(() => {
      ordem.push('unregister')
      return Promise.resolve({ result: { result: true } })
    })

    const adapter = new BitrixWelcomeBotAdapter(
      { callMethod } as unknown as BitrixClient,
      {
        get: { getByFlowId: vi.fn().mockResolvedValue(bot) },
        list: { listByAppId: vi.fn().mockResolvedValue([]) },
        save: { save: vi.fn() },
        delete: {
          delete: vi.fn().mockImplementation(() => {
            ordem.push('delete')
            return Promise.resolve()
          }),
        },
        bindings: { listByAppId: vi.fn().mockResolvedValue([]) },
      },
    )

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(ordem).toEqual(['unregister', 'delete'])
  })

  it('falha no portal não sobe: o fluxo já foi apagado', async () => {
    // Sobra um bot sem uso, reaproveitado no próximo vínculo: subir o erro trocaria um
    // resíduo inofensivo por uma exclusão que "falhou" na tela.
    const { adapter, del } = setup({
      bot,
      bindings: [],
      callMethod: vi.fn().mockRejectedValue(new Error('boom')),
    })

    await expect(adapter.removeBotIfUnused(APP, 'f1')).resolves.toBeUndefined()
    // Não apaga do nosso banco: o bot ainda está no portal.
    expect(del).not.toHaveBeenCalled()
  })

  it('unbindLine desliga e confirma por leitura de volta', async () => {
    const callMethod = vi
      .fn()
      .mockImplementation((metodo: string) =>
        metodo === 'imopenlines.config.get'
          ? Promise.resolve({ result: { WELCOME_BOT_ENABLE: 'N' } })
          : Promise.resolve({ result: true }),
      )
    const { adapter } = setup({ bot, callMethod })

    await adapter.unbindLine({ lineId: '7' })

    // `WELCOME_BOT_ID: 0` junto: `removeBotIfUnused` pode desregistrar o bot em seguida, e
    // o id sobrando apontaria para um bot que não existe mais.
    expect(callMethod).toHaveBeenCalledWith('imopenlines.config.update', {
      CONFIG_ID: '7',
      PARAMS: { WELCOME_BOT_ENABLE: 'N', WELCOME_BOT_ID: 0 },
    })
    expect(callMethod).toHaveBeenCalledWith('imopenlines.config.get', {
      CONFIG_ID: '7',
    })
  })

  it('unbindLine falha se o bot continua ligado na linha', async () => {
    // Quem chama apaga o vínculo em seguida: sem esta recusa, o bot ficaria ativo numa
    // linha sem fluxo.
    const callMethod = vi.fn().mockImplementation((metodo: string) =>
      metodo === 'imopenlines.config.get'
        ? Promise.resolve({
            result: { WELCOME_BOT_ENABLE: 'Y', WELCOME_BOT_ID: 42 },
          })
        : Promise.resolve({ result: true }),
    )
    const { adapter } = setup({ bot, callMethod })

    await expect(adapter.unbindLine({ lineId: '7' })).rejects.toThrow()
  })
})

describe('um bot por fluxo', () => {
  it('vínculo de outro fluxo não segura o bot deste', async () => {
    const { adapter, callMethod, del } = setup({
      bot,
      bindings: [{ ...vinculo(), flowId: 'f2' }],
    })

    await adapter.removeBotIfUnused(APP, 'f1')

    expect(callMethod).toHaveBeenCalledWith('imbot.v2.Bot.unregister', {
      botId: 42,
      botToken: 'token-1',
    })
    expect(del).toHaveBeenCalledWith(APP, 42)
  })

  it('linha com o bot de outro fluxo nosso não é recusada', async () => {
    // Bot do fluxo A posto pelo painel numa linha que agora vai para o fluxo B: é nosso,
    // não de outro app.
    const callMethod = vi.fn().mockImplementation((metodo: string) =>
      metodo === 'imopenlines.config.get'
        ? Promise.resolve({
            result: {
              WELCOME_BOT_ENABLE: 'Y',
              WELCOME_BOT_ID: callMethod.mock.calls.length > 2 ? 43 : 42,
            },
          })
        : Promise.resolve({ result: true }),
    )

    const adapter = new BitrixWelcomeBotAdapter(
      { callMethod } as unknown as BitrixClient,
      {
        get: { getByFlowId: vi.fn() },
        list: { listByAppId: vi.fn().mockResolvedValue([bot]) },
        save: { save: vi.fn() },
        delete: { delete: vi.fn() },
        bindings: { listByAppId: vi.fn().mockResolvedValue([]) },
      },
    )

    await expect(
      adapter.bindLine({ appId: APP, lineId: '7', bitrixBotId: 43 }),
    ).resolves.toBeUndefined()
  })
})
