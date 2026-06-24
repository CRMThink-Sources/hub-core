import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import type { CommunicateBy } from '../domain/entities/signer'
import {
  ClicksignGroup,
  ContactSettings,
  pickCode,
} from './clicksign-settings.types'

export interface SignerSpec {
  name: string
  email: string
  hasDocumentation: boolean
  refusable: boolean
  group: number | string
  communicateBy: CommunicateBy
  documentation?: string
  signAs: string
}

type DealRecord = Record<string, unknown>

interface BitrixUser {
  EMAIL?: string
  NAME?: string
  LAST_NAME?: string
}

interface BitrixContact {
  NAME?: string
  LAST_NAME?: string
  EMAIL?: Array<{ VALUE?: string }>
  [key: string]: unknown
}

interface BuildSignersInput {
  group: ClicksignGroup
  deal: DealRecord
  contactSettings: ContactSettings | null
  refusable: boolean
  communicateBy: CommunicateBy
  bitrix: BitrixRestClient
}

// Quirks de paridade com o flow Prismatic: participante `has_documentation` é
// negado; contato é `!!cpf`.
export async function buildSigners(
  input: BuildSignersInput,
): Promise<SignerSpec[]> {
  const participantes = await buildParticipantes(input)
  const contatos = await buildContatos(input)
  return [...participantes, ...contatos]
}

async function buildParticipantes(
  input: BuildSignersInput,
): Promise<SignerSpec[]> {
  const { group, deal, refusable, communicateBy, bitrix } = input
  const list = group.participantes ?? []

  return Promise.all(
    list.map(async p => {
      let name = ''
      let email = p.email ?? ''

      // `campo_usuario` (id num campo do deal) ou `contato` (id fixo). Resolve
      // via user.get para puxar nome/e-mail em vez do id cru.
      const userId = p.campo_usuario ? deal[p.campo_usuario] : p.contato
      if (userId) {
        const user = await getUser(bitrix, userId)
        if (user) {
          email = user.EMAIL ?? email
          name = `${user.NAME ?? ''} ${user.LAST_NAME ?? ''}`.trim()
        }
      }

      return {
        name,
        email,
        documentation: p.cpf ?? undefined,
        hasDocumentation: !p.has_documentation,
        signAs: pickCode(p.parte) ?? 'sign',
        group: typeof p.grupo === 'number' ? p.grupo : 1,
        refusable,
        communicateBy,
      }
    }),
  )
}

async function buildContatos(input: BuildSignersInput): Promise<SignerSpec[]> {
  const { group, deal, contactSettings, refusable, communicateBy, bitrix } =
    input
  const list = group.contatos ?? []
  const cpfFieldCode = pickCode(contactSettings?.documentation ?? null)
  const partFieldCode = contactSettings?.part?.code

  // Contatos padrão vêm todos do mesmo deal: um batch só, evita N+1.
  const hasPadrao = list.some(c => c.contato_padrao)
  const contactsById = hasPadrao
    ? await getDealContacts(bitrix, deal.ID)
    : new Map<number, BitrixContact>()

  const nested = list.map((contato): SignerSpec[] => {
    if (contato.contato_padrao) {
      return [...contactsById.values()].map(contact => {
        const cpf = cpfFieldCode ? str(contact?.[cpfFieldCode]) : ''
        const rawSignAs = partFieldCode ? str(contact?.[partFieldCode]) : ''
        return {
          name: `${contact?.NAME ?? ''} ${contact?.LAST_NAME ?? ''}`.trim(),
          email: contact?.EMAIL?.[0]?.VALUE ?? '',
          documentation: cpf || undefined,
          hasDocumentation: !!cpf,
          signAs: rawSignAs !== '' ? rawSignAs : 'sign',
          group: contato.contato_group ?? 1,
          refusable,
          communicateBy,
        }
      })
    }

    const cpf = contato.contato_cpf ? str(deal[contato.contato_cpf]) : ''
    return [
      {
        name: contato.contato_nome ? str(deal[contato.contato_nome]) : '',
        email: contato.contato_email ? str(deal[contato.contato_email]) : '',
        documentation: cpf || undefined,
        hasDocumentation: !!cpf,
        signAs: 'sign',
        group: contato.contato_group ?? 1,
        refusable,
        communicateBy,
      },
    ]
  })

  return nested.flat()
}

function str(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

async function getUser(
  bitrix: BitrixRestClient,
  id: unknown,
): Promise<BitrixUser | null> {
  const res = (await bitrix.callMethod('user.get', { ID: id })) as
    | BitrixUser[]
    | undefined
  return res?.[0] ?? null
}

async function listDealContactIds(
  bitrix: BitrixRestClient,
  dealId: unknown,
): Promise<number[]> {
  const res = (await bitrix.callMethod('crm.deal.contact.items.get', {
    id: dealId,
  })) as Array<{ CONTACT_ID: number }> | undefined
  return (res ?? []).map(item => item.CONTACT_ID)
}

async function getDealContacts(
  bitrix: BitrixRestClient,
  dealId: unknown,
): Promise<Map<number, BitrixContact>> {
  const ids = await listDealContactIds(bitrix, dealId)
  const result = new Map<number, BitrixContact>()

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const commands: Record<
      string,
      { method: string; params: Record<string, string | number | boolean> }
    > = {}
    for (const id of chunk) {
      commands[String(id)] = { method: 'crm.contact.get', params: { ID: id } }
    }
    const res = await bitrix.callBatch(commands)
    for (const id of chunk) {
      const contact = res[String(id)] as BitrixContact | undefined
      if (contact) result.set(id, contact)
    }
  }

  return result
}
