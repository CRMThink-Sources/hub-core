import { describe, expect, it, vi } from 'vitest'
import { ImbotGateway, type BitrixMethodCaller } from './imbot.gateway'

const caller = (
  response: unknown,
): BitrixMethodCaller & {
  callMethod: ReturnType<typeof vi.fn>
} => {
  const callMethod = vi.fn().mockResolvedValue(response)
  return { callMethod }
}

/**
 * Os dois clients do projeto divergem no retorno: um devolve `data.result`, o
 * outro o envelope inteiro. O gateway atende os dois, e é essa diferença que
 * fazia `imbot.register` reprovar um bot que o portal tinha criado.
 */
describe('register', () => {
  it('lê o id do envelope do Bitrix', async () => {
    const bitrix = caller({ result: 2046, time: { duration: 1.38 } })

    expect(
      await new ImbotGateway(bitrix).register({
        name: 'Atendimento',
        eventHandlerUrl: 'https://api.exemplo/webhook',
      }),
    ).toBe(2046)
  })

  it('lê o id da resposta já desembrulhada', async () => {
    const bitrix = caller(2046)

    expect(
      await new ImbotGateway(bitrix).register({
        name: 'Atendimento',
        eventHandlerUrl: 'https://api.exemplo/webhook',
      }),
    ).toBe(2046)
  })

  it('registra com OPENLINE para o bot atender canal aberto', async () => {
    const bitrix = caller({ result: 7 })

    await new ImbotGateway(bitrix).register({
      name: 'Atendimento',
      eventHandlerUrl: 'https://api.exemplo/webhook',
    })

    expect(bitrix.callMethod).toHaveBeenCalledWith(
      'imbot.register',
      expect.objectContaining({
        OPENLINE: 'Y',
        TYPE: 'B',
        EVENT_HANDLER: 'https://api.exemplo/webhook',
        PROPERTIES: { NAME: 'Atendimento' },
      }),
    )
  })

  it('falha quando o Bitrix não devolve um id', async () => {
    const bitrix = caller({ result: null })

    await expect(
      new ImbotGateway(bitrix).register({
        name: 'Atendimento',
        eventHandlerUrl: 'https://api.exemplo/webhook',
      }),
    ).rejects.toMatchObject({ errorCode: 'gptmaker.bot.create_failed' })
  })
})

describe('listApplicationBots', () => {
  const BOTS = {
    0: { ID: '2046', CODE: 'gptmaker_1', PROPERTIES: { NAME: 'Atendimento' } },
    1: { ID: '9', CODE: 'thinkzap_audio', PROPERTIES: { NAME: 'Áudio' } },
  }

  it('lê a lista dentro do envelope e filtra pelo prefixo da aplicação', async () => {
    const bitrix = caller({ result: BOTS, time: { duration: 0.2 } })

    expect(await new ImbotGateway(bitrix).listApplicationBots()).toEqual([
      { id: 2046, code: 'gptmaker_1', name: 'Atendimento' },
    ])
  })

  it('lê a lista já desembrulhada', async () => {
    const bitrix = caller(BOTS)

    expect(await new ImbotGateway(bitrix).listApplicationBots()).toHaveLength(1)
  })

  it('aceita resposta em array', async () => {
    const bitrix = caller([{ ID: 3, CODE: 'gptmaker_3', NAME: 'Vendas' }])

    expect(await new ImbotGateway(bitrix).listApplicationBots()).toEqual([
      { id: 3, code: 'gptmaker_3', name: 'Vendas' },
    ])
  })

  it('cai para o code quando o bot não tem nome', async () => {
    const bitrix = caller([{ ID: 3, CODE: 'gptmaker_3' }])

    expect(
      (await new ImbotGateway(bitrix).listApplicationBots())[0]?.name,
    ).toBe('gptmaker_3')
  })

  it('devolve vazio quando o portal não responde nada', async () => {
    const bitrix = caller(undefined)

    expect(await new ImbotGateway(bitrix).listApplicationBots()).toEqual([])
  })
})
