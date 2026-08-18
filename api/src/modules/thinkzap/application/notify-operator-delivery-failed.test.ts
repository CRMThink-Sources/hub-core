import { describe, expect, it, vi } from 'vitest'

import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { notifyOperatorDeliveryFailed } from './notify-operator-delivery-failed'

function makeClient(callMethod = vi.fn().mockResolvedValue({ result: 4242 })) {
  return { client: { callMethod } as unknown as BitrixClient, callMethod }
}

describe('notifyOperatorDeliveryFailed', () => {
  it('posta como bot no chat do canal aberto', async () => {
    const { client, callMethod } = makeClient()

    const outcome = await notifyOperatorDeliveryFailed(
      client,
      1958,
      '100',
      'não entregue',
    )

    expect(outcome).toMatchObject({ posted: true, bitrixMessageId: '4242' })

    // SYSTEM=Y: aviso de conector nao e fala de operador nem de contato.
    expect(callMethod).toHaveBeenCalledWith('imbot.message.add', {
      BOT_ID: 1958,
      DIALOG_ID: 'chat100',
      MESSAGE: 'não entregue',
      SYSTEM: 'Y',
    })
  })

  /**
   * O desfecho já aconteceu e retentar não muda nada — lançar aqui só faria a fila
   * reprocessar o job para chegar ao mesmo lugar.
   */
  it('falha do Bitrix não propaga, e devolve o motivo', async () => {
    const { client, callMethod } = makeClient(
      vi.fn().mockRejectedValue(new Error('bitrix fora')),
    )

    await expect(
      notifyOperatorDeliveryFailed(client, 1958, '100', 'não entregue'),
    ).resolves.toMatchObject({ posted: false })
    // Duas tentativas: bot e, na recusa, usuario do app.
    expect(callMethod).toHaveBeenCalledTimes(2)
  })

  /**
   * O caso que o log de produção expôs: `imbot.message.add` responde **HTTP 200** com
   * `error` e nenhuma mensagem é criada. Presumir sucesso aqui é o que fazia a aba Logs
   * dizer "aviso postado" com o chat vazio.
   */
  it('HTTP 200 com error não conta como postado', async () => {
    const { client } = makeClient(
      vi.fn().mockResolvedValue({
        error: 'BOT_ID_ERROR',
        error_description: 'Bot not found',
      }),
    )

    await expect(
      notifyOperatorDeliveryFailed(client, 1958, '100', 'não entregue'),
    ).resolves.toMatchObject({
      posted: false,
      reason: expect.stringContaining('Bot not found') as unknown as string,
    })
  })

  it('result falso não conta como postado', async () => {
    const { client } = makeClient(vi.fn().mockResolvedValue({ result: false }))

    const outcome = await notifyOperatorDeliveryFailed(
      client,
      1958,
      '100',
      'não entregue',
    )

    expect(outcome.posted).toBe(false)
  })
})
