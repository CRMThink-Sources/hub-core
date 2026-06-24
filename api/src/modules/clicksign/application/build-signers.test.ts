import { describe, expect, it } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildSigners } from './build-signers'
import type {
  ClicksignGroup,
  ContactSettings,
} from './clicksign-settings.types'

type Handlers = {
  method?: Record<string, (params: Record<string, unknown>) => unknown>
  batch?: (cmds: Record<string, unknown>) => Record<string, unknown>
}

function makeBitrix(h: Handlers): BitrixRestClient {
  return {
    callMethod: async (method: string, params: Record<string, unknown>) =>
      h.method?.[method]?.(params),
    callBatch: async (cmds: Record<string, unknown>) => h.batch?.(cmds) ?? {},
  } as unknown as BitrixRestClient
}

describe('buildSigners — participante', () => {
  it('resolve nome/email via user.get e nega has_documentation', async () => {
    const group = {
      id: 'g',
      participantes: [
        {
          contato: '5',
          parte: 'role1',
          grupo: 2,
          has_documentation: false,
          cpf: '123',
          email: 'fallback@x.com',
        },
      ],
    } as unknown as ClicksignGroup

    const bitrix = makeBitrix({
      method: {
        'user.get': () => [{ EMAIL: 'u@x.com', NAME: 'Ana', LAST_NAME: 'Lima' }],
      },
    })

    const signers = await buildSigners({
      group,
      deal: {},
      contactSettings: null,
      refusable: true,
      communicateBy: 'email',
      bitrix,
    })

    expect(signers).toEqual([
      {
        name: 'Ana Lima',
        email: 'u@x.com',
        documentation: '123',
        hasDocumentation: true,
        signAs: 'role1',
        group: 2,
        refusable: true,
        communicateBy: 'email',
      },
    ])
  })
})

describe('buildSigners — contato custom', () => {
  it('lê nome/email/cpf de campos do deal; hasDocumentation = !!cpf', async () => {
    const group = {
      id: 'g',
      contatos: [
        {
          contato_padrao: false,
          contato_nome: 'NOME_CODE',
          contato_email: 'EMAIL_CODE',
          contato_cpf: 'CPF_CODE',
          contato_group: 3,
        },
      ],
    } as unknown as ClicksignGroup

    const signers = await buildSigners({
      group,
      deal: { NOME_CODE: 'Carlos', EMAIL_CODE: 'c@x.com', CPF_CODE: '999' },
      contactSettings: null,
      refusable: false,
      communicateBy: 'sms',
      bitrix: makeBitrix({}),
    })

    expect(signers).toEqual([
      {
        name: 'Carlos',
        email: 'c@x.com',
        documentation: '999',
        hasDocumentation: true,
        signAs: 'sign',
        group: 3,
        refusable: false,
        communicateBy: 'sms',
      },
    ])
  })
})

describe('buildSigners — contato padrão', () => {
  it('puxa os contatos do deal em batch e usa os campos de contact_settings', async () => {
    const group = {
      id: 'g',
      contatos: [{ contato_padrao: true, contato_group: 1 }],
    } as unknown as ClicksignGroup

    const contactSettings = {
      documentation: 'UF_CPF',
      part: { code: 'UF_PART', name: 'Assinar como' },
    } as unknown as ContactSettings

    const bitrix = makeBitrix({
      method: {
        'crm.deal.contact.items.get': () => [{ CONTACT_ID: 10 }],
      },
      batch: () => ({
        '10': {
          NAME: 'Dora',
          LAST_NAME: 'Reis',
          EMAIL: [{ VALUE: 'd@x.com' }],
          UF_CPF: '555',
          UF_PART: 'corretor',
        },
      }),
    })

    const signers = await buildSigners({
      group,
      deal: { ID: 1 },
      contactSettings,
      refusable: false,
      communicateBy: 'email',
      bitrix,
    })

    expect(signers).toEqual([
      {
        name: 'Dora Reis',
        email: 'd@x.com',
        documentation: '555',
        hasDocumentation: true,
        signAs: 'corretor',
        group: 1,
        refusable: false,
        communicateBy: 'email',
      },
    ])
  })
})
