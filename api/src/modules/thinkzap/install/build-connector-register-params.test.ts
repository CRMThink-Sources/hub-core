import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      connector: {
        code: 'hubthink_thinkzap',
        name: 'ThinkZap',
        url: 'https://app.test/connector',
      },
    },
  },
}))

import { buildConnectorRegisterParams } from './build-connector-register-params'

describe('buildConnectorRegisterParams', () => {
  /**
   * O teste que existe para não regredir de novo.
   *
   * Este campo esteve `'N'` desde o primeiro commit, e foi o que manteve a
   * sincronização de exclusão sem funcionar entre 2026-06 e 2026-08: o Bitrix recusa
   * a exclusão no servidor e não emite evento nenhum. Voltar para `'N'` desliga o
   * recurso inteiro sem quebrar nenhum outro teste — é falha silenciosa por
   * construção, e por isso tem asserção própria.
   */
  it('declara suporte a exclusão de mensagem do operador', () => {
    expect(buildConnectorRegisterParams().DEL_INTERNAL_MESSAGES).toBe('Y')
  })

  /** Edição segue descontinuada: ligar ofereceria controle que não propaga. */
  it('não declara suporte a edição de mensagem do operador', () => {
    expect(buildConnectorRegisterParams().EDIT_INTERNAL_MESSAGES).toBe('N')
  })

  /**
   * Necessário para remover do canal aberto a mensagem que o contato apagou no
   * WhatsApp (`REVOKE` da Z-API).
   */
  it('declara suporte a exclusão de mensagem recebida', () => {
    expect(buildConnectorRegisterParams().DEL_EXTERNAL_MESSAGES).toBe('Y')
  })

  /**
   * O corpo é enviado inteiro no re-registro, que **atualiza** o conector. Campo que
   * sumir daqui some do portal de toda a base — ícone e handler inclusive.
   */
  it('monta o corpo completo do registro', () => {
    const params = buildConnectorRegisterParams()

    expect(Object.keys(params).sort()).toEqual([
      'CHAT_GROUP',
      'DEL_EXTERNAL_MESSAGES',
      'DEL_INTERNAL_MESSAGES',
      'EDIT_INTERNAL_MESSAGES',
      'ICON',
      'ID',
      'NAME',
      'NEED_SIGNATURE',
      'PLACEMENT_HANDLER',
    ])
  })

  it('resolve identidade e handler do ambiente', () => {
    const params = buildConnectorRegisterParams()

    expect(params).toMatchObject({
      ID: 'hubthink_thinkzap',
      NAME: 'ThinkZap',
      PLACEMENT_HANDLER: 'https://app.test/connector',
    })
  })

  /** O ícone vai como data URI: o Bitrix não busca a imagem por URL. */
  it('leva o ícone embutido', () => {
    const icon = buildConnectorRegisterParams().ICON as {
      DATA_IMAGE: string
      COLOR: string
    }

    expect(icon.DATA_IMAGE).toMatch(/^data:image\/svg\+xml;/)
    expect(icon.COLOR).toBe('#25D366')
  })
})
