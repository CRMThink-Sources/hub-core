import { describe, expect, it } from 'vitest'
import { resolveOpenChannelContactId } from './open-channel-contact-id'

describe('resolveOpenChannelContactId', () => {
  /**
   * O ponto todo do helper: as formas que o envio pelo widget e o inbound do provider
   * escrevem para o mesmo contato têm que chegar ao mesmo valor. Enquanto não
   * chegavam, o Bitrix abria uma conversa para o envio e outra para a resposta.
   */
  it('faz convergir as formas equivalentes do mesmo telefone', () => {
    const canonical = '5547992259475'

    // Como a HubMessage entrega o remetente: celular BR sem o 9º dígito.
    expect(resolveOpenChannelContactId('554792259475')).toBe(canonical)
    // Como o operador digita no widget: sem código de país.
    expect(resolveOpenChannelContactId('4792259475')).toBe(canonical)
    // Como o número aparece colado de um cadastro.
    expect(resolveOpenChannelContactId('+55 47 99225-9475')).toBe(canonical)
  })

  it('mantém o lid cru para contato em modo privacidade', () => {
    expect(resolveOpenChannelContactId('123456789012345@lid')).toBe(
      '123456789012345@lid',
    )
  })

  it('mantém o jid cru para grupo', () => {
    expect(resolveOpenChannelContactId('120363000000000000-group')).toBe(
      '120363000000000000-group',
    )
  })

  /**
   * String vazia sai vazia de propósito: é o que faz o guard `if (!chatId)` do
   * inbound continuar reprovando payload malformado em vez de mandar um `chat.id`
   * inventado ao Bitrix.
   */
  it('devolve string vazia para entrada vazia', () => {
    expect(resolveOpenChannelContactId('')).toBe('')
  })
})
