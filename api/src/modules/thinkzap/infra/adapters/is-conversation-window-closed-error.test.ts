import { describe, expect, it } from 'vitest'

import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { isConversationWindowClosedError } from './is-conversation-window-closed-error'

function makeApiError(status: number | undefined, body: unknown) {
  return new HubMessageApiError(
    status,
    'POST',
    '/v1/channels/CH/messages',
    body,
    null,
  )
}

describe('isConversationWindowClosedError', () => {
  it('422 com mensagem de janela fechada → true', () => {
    const error = makeApiError(422, {
      message: 'A janela de conversa de 24 horas está fechada',
    })
    expect(isConversationWindowClosedError(error)).toBe(true)
  })

  it('400 exigindo template → true', () => {
    const error = makeApiError(400, {
      message: 'Outside 24h window, only approved template allowed',
    })
    expect(isConversationWindowClosedError(error)).toBe(true)
  })

  it('corpo em string cru também casa', () => {
    const error = makeApiError(422, 'conversation window expired')
    expect(isConversationWindowClosedError(error)).toBe(true)
  })

  // Default conservador: na dúvida retenta.
  it('401 → false', () => {
    const error = makeApiError(401, { message: 'Token inválido ou ausente' })
    expect(isConversationWindowClosedError(error)).toBe(false)
  })

  it('500 → false', () => {
    const error = makeApiError(500, { message: 'Internal server error' })
    expect(isConversationWindowClosedError(error)).toBe(false)
  })

  it('422 com motivo não relacionado → false', () => {
    const error = makeApiError(422, { message: 'Telefone inválido' })
    expect(isConversationWindowClosedError(error)).toBe(false)
  })

  it('422 sem corpo legível → false (status sozinho nunca basta)', () => {
    const error = makeApiError(422, null)
    expect(isConversationWindowClosedError(error)).toBe(false)
  })

  it('status ausente (erro de rede) → false', () => {
    const error = makeApiError(undefined, undefined)
    expect(isConversationWindowClosedError(error)).toBe(false)
  })

  it('erro que não é da HubMessage → false', () => {
    expect(isConversationWindowClosedError(new Error('janela fechada'))).toBe(
      false,
    )
    expect(isConversationWindowClosedError(null)).toBe(false)
    expect(isConversationWindowClosedError('janela')).toBe(false)
  })
})
