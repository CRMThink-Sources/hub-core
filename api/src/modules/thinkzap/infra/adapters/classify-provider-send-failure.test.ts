import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { AppError } from '@/shared/domain/errors/app-error'
import { classifyProviderSendFailure } from './classify-provider-send-failure'

const axiosWithResponse = (status: number) =>
  new AxiosError('falhou', 'ERR_BAD_RESPONSE', undefined, null, {
    status,
    statusText: '',
    data: {},
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  })

const axiosWithoutResponse = () =>
  new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED')

const wrapped = (cause: unknown) =>
  new AppError(
    'thinkzap.zapi.message_send_failed',
    'integration',
    'Falha ao enviar',
    'Tentar de novo',
    500,
    true,
    cause,
  )

describe('classifyProviderSendFailure', () => {
  describe('HubMessage', () => {
    it.each([400, 422, 500, 502])(
      'classifica resposta %d como recusa — nada foi entregue',
      status => {
        const error = new HubMessageApiError(status, 'POST', '/m', {}, null)

        expect(classifyProviderSendFailure(error)).toBe('refused')
      },
    )

    it('classifica ausência de status como indeterminado', () => {
      const error = new HubMessageApiError(undefined, 'POST', '/m', null, null)

      expect(classifyProviderSendFailure(error)).toBe('indeterminate')
    })
  })

  describe('Z-API', () => {
    /**
     * O client da Z-API embrulha o `AxiosError` em `AppError` via `thinkzapError`, então
     * a resposta HTTP vive na `cause`. Sem desembrulhar, todo erro da Z-API pareceria
     * indeterminado e **nenhum** envio seria retentado — que é exatamente a perda de
     * mensagem que esta change existe para acabar.
     */
    it('desembrulha o AppError e reconhece a resposta HTTP como recusa', () => {
      const error = wrapped(axiosWithResponse(500))

      expect(classifyProviderSendFailure(error)).toBe('refused')
    })

    it('desembrulha o AppError e reconhece timeout como indeterminado', () => {
      const error = wrapped(axiosWithoutResponse())

      expect(classifyProviderSendFailure(error)).toBe('indeterminate')
    })

    it('reconhece AxiosError cru com resposta', () => {
      expect(classifyProviderSendFailure(axiosWithResponse(400))).toBe(
        'refused',
      )
    })
  })

  /**
   * Default conservador. Um falso `indeterminate` custa uma mensagem não enviada e um
   * aviso ao operador — ruim, mas visível e recuperável. Um falso `refused` custa
   * mensagem repetida no WhatsApp do cliente do parceiro, que ninguém desfaz.
   */
  describe('desconhecido', () => {
    it.each([
      ['Error comum', new Error('boom')],
      ['string', 'boom'],
      ['null', null],
      ['undefined', undefined],
      ['AppError sem cause', wrapped(undefined)],
    ])('classifica %s como indeterminado', (_label, error) => {
      expect(classifyProviderSendFailure(error)).toBe('indeterminate')
    })
  })
})
