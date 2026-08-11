import {
  BITRIX_ENTITY_TYPES,
  BITRIX_SPA_CLIENT_FIELDS,
  STATUS_OPTIONS,
} from '@/shared/domain/config/bitrix.env'
import { Spa } from '@/shared/domain/entities/spa'
import { SpaClientContact } from '@/shared/domain/entities/spa-client-contact'
import {
  CreateSpaParams,
  CreateSpaRepository,
} from '@/shared/domain/repositories/spa/create-spa.repository'
import { GetSpaRepository } from '@/shared/domain/repositories/spa/get-spa.repository'
import {
  GetSpaClientContactRepository,
  UpdateSpaClientContactRepository,
} from '@/shared/domain/repositories/spa/spa-client-contact.repository'
import {
  UpdateSpaParams,
  UpdateSpaRepository,
} from '@/shared/domain/repositories/spa/update-spa.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/** Campos que a leitura pede: sem `select` o Bitrix não devolve userfield. */
const SPA_CLIENT_SELECT = [
  'id',
  BITRIX_SPA_CLIENT_FIELDS.MEMBER_ID,
  BITRIX_SPA_CLIENT_FIELDS.NAME,
  BITRIX_SPA_CLIENT_FIELDS.EMAIL,
  BITRIX_SPA_CLIENT_FIELDS.PHONE,
  BITRIX_SPA_CLIENT_FIELDS.COMPANY,
]

/** Item cru da SPA. O tipo do client declara só `id`; os userfields vêm por code. */
type RawSpaItem = Record<string, unknown>

/**
 * Campo de texto do Bitrix, como `string`.
 *
 * Ausente, `null` e número resolvem string: o contrato de `Spa` e de
 * `SpaClientContact` declara `string`, e devolver `null` num campo tipado assim é
 * a mentira que a versão anterior deste repositório contava — ela devolvia `''`
 * **fixo** em cinco campos, sem nem pedi-los no `select`.
 */
function text(item: RawSpaItem, field: string): string {
  const value = item[field]
  if (typeof value === 'string') return value
  /**
   * Número vira string porque o Bitrix devolve campo de texto numérico assim
   * (telefone só com dígitos, por exemplo). Qualquer outra coisa — objeto, array,
   * booleano — não é o campo de texto que este mapeamento espera, e resolve vazio
   * em vez de `[object Object]` no CRM.
   */
  return typeof value === 'number' ? String(value) : ''
}

function toContact(item: RawSpaItem): SpaClientContact {
  return {
    name: text(item, BITRIX_SPA_CLIENT_FIELDS.NAME),
    email: text(item, BITRIX_SPA_CLIENT_FIELDS.EMAIL),
    phone: text(item, BITRIX_SPA_CLIENT_FIELDS.PHONE),
    company: text(item, BITRIX_SPA_CLIENT_FIELDS.COMPANY),
  }
}

/**
 * Campo de contato só é enviado quando tem valor.
 *
 * `InstallApp` não conhece nome, telefone e empresa — eles são capturados na
 * ativação do trial. Enviar `''` por "não tenho o dado" faria uma reinstalação
 * **apagar** o contato comercial, sem erro e sem sintoma. Vazio aqui significa
 * "não mexe", e é a segunda camada da defesa: a primeira é o chamador não mandar.
 */
function contactPatch(
  params: Pick<UpdateSpaParams, 'name' | 'email' | 'phone' | 'company'>,
): Record<string, unknown> {
  const entries: Array<[string, string | undefined]> = [
    [BITRIX_SPA_CLIENT_FIELDS.NAME, params.name],
    [BITRIX_SPA_CLIENT_FIELDS.EMAIL, params.email],
    [BITRIX_SPA_CLIENT_FIELDS.PHONE, params.phone],
    [BITRIX_SPA_CLIENT_FIELDS.COMPANY, params.company],
  ]

  return Object.fromEntries(
    entries.filter(([, value]) => value !== undefined && value !== ''),
  )
}

export class BitrixSpaRepository
  implements
    GetSpaRepository,
    CreateSpaRepository,
    UpdateSpaRepository,
    GetSpaClientContactRepository,
    UpdateSpaClientContactRepository
{
  constructor(private readonly bitrix: BitrixClient) {}

  async get(params: { appId: string; domain: string }): Promise<Spa | null> {
    const response = await this.bitrix.listCrmItems(
      BITRIX_ENTITY_TYPES.SPA_CLIENT,
      {
        [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: params.appId,
        [BITRIX_SPA_CLIENT_FIELDS.DOMAIN]: params.domain,
      },
      { select: SPA_CLIENT_SELECT },
    )

    const item = response.result?.items?.[0] as RawSpaItem | undefined
    if (!item) return null

    return {
      id: String(item.id),
      appId: params.appId,
      domain: params.domain,
      memberId: text(item, BITRIX_SPA_CLIENT_FIELDS.MEMBER_ID),
      ...toContact(item),
      trialExpiresAt: null,
      trialCustomerId: null,
      trialSubscriptionId: null,
    }
  }

  /**
   * Contato por id do item: uma chamada, sem listagem para descobrir um id que o
   * chamador já tem.
   *
   * `crm.item.get` devolve o item completo, com os userfields — o `select` que a
   * listagem precisa não existe aqui.
   */
  async getContact(itemId: string): Promise<SpaClientContact> {
    const response = await this.bitrix.getCrmItem(
      BITRIX_ENTITY_TYPES.SPA_CLIENT,
      itemId,
    )

    return toContact(response.result.item)
  }

  /**
   * Escreve os quatro campos de contato. Sem busca prévia e sem criar item — id
   * que não existe faz o Bitrix recusar, e é isso que tem que acontecer.
   */
  async updateContact(
    itemId: string,
    contact: SpaClientContact,
  ): Promise<void> {
    await this.bitrix.updateCrmItem(BITRIX_ENTITY_TYPES.SPA_CLIENT, itemId, {
      [BITRIX_SPA_CLIENT_FIELDS.NAME]: contact.name,
      [BITRIX_SPA_CLIENT_FIELDS.EMAIL]: contact.email,
      [BITRIX_SPA_CLIENT_FIELDS.PHONE]: contact.phone,
      [BITRIX_SPA_CLIENT_FIELDS.COMPANY]: contact.company,
    })
  }

  /**
   * Criação escreve os campos de contato **como recebidos**, inclusive vazios: a
   * instalação não tem o dado, e item nascendo vazio é o estado inicial correto.
   * A regra de "vazio não sobrescreve" é do `update`, onde existe valor anterior
   * a proteger.
   */
  async create(params: CreateSpaParams): Promise<Spa> {
    const response = await this.bitrix.createCrmItem(
      BITRIX_ENTITY_TYPES.SPA_CLIENT,
      {
        [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: params.appId,
        [BITRIX_SPA_CLIENT_FIELDS.DOMAIN]: params.domain,
        [BITRIX_SPA_CLIENT_FIELDS.MEMBER_ID]: params.memberId,
        [BITRIX_SPA_CLIENT_FIELDS.NAME]: params.name,
        [BITRIX_SPA_CLIENT_FIELDS.EMAIL]: params.email,
        [BITRIX_SPA_CLIENT_FIELDS.PHONE]: params.phone,
        [BITRIX_SPA_CLIENT_FIELDS.COMPANY]: params.company,
        [BITRIX_SPA_CLIENT_FIELDS.TRIAL_EXPIRES_AT]:
          params.trialExpiresAt ?? null,
        [BITRIX_SPA_CLIENT_FIELDS.TRIAL_CUSTOMER_ID]:
          params.trialCustomerId ?? null,
        [BITRIX_SPA_CLIENT_FIELDS.TRIAL_SUBSCRIPTION_ID]:
          params.trialSubscriptionId ?? null,
        [BITRIX_SPA_CLIENT_FIELDS.STATUS]:
          STATUS_OPTIONS[params.status as keyof typeof STATUS_OPTIONS] ?? null,
      },
    )

    return {
      id: response.result.item.id,
      ...params,
      trialExpiresAt: params.trialExpiresAt ?? null,
      trialCustomerId: params.trialCustomerId ?? null,
      trialSubscriptionId: params.trialSubscriptionId ?? null,
      status: params.status ?? null,
    }
  }

  async update(params: UpdateSpaParams): Promise<Spa> {
    const existing = await this.get({
      appId: params.appId,
      domain: params.domain,
    })

    if (!existing) {
      throw new Error('SPA not found to update')
    }

    const contact = contactPatch(params)

    await this.bitrix.updateCrmItem(
      BITRIX_ENTITY_TYPES.SPA_CLIENT,
      existing.id,
      {
        ...contact,
        ...(params.trialExpiresAt !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.TRIAL_EXPIRES_AT]: params.trialExpiresAt,
        }),
        ...(params.trialCustomerId !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.TRIAL_CUSTOMER_ID]: params.trialCustomerId,
        }),
        ...(params.trialSubscriptionId !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.TRIAL_SUBSCRIPTION_ID]:
            params.trialSubscriptionId,
        }),
        ...(params.status !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.STATUS]:
            STATUS_OPTIONS[params.status as keyof typeof STATUS_OPTIONS] ??
            null,
        }),
      },
    )

    /**
     * O retorno reflete o que **foi escrito**, não o que foi pedido: campo de
     * contato descartado por ser vazio mantém o valor lido do item, senão o
     * chamador receberia `''` num campo que continua preenchido no CRM.
     */
    return {
      ...existing,
      ...params,
      name: (contact[BITRIX_SPA_CLIENT_FIELDS.NAME] as string) ?? existing.name,
      email:
        (contact[BITRIX_SPA_CLIENT_FIELDS.EMAIL] as string) ?? existing.email,
      phone:
        (contact[BITRIX_SPA_CLIENT_FIELDS.PHONE] as string) ?? existing.phone,
      company:
        (contact[BITRIX_SPA_CLIENT_FIELDS.COMPANY] as string) ??
        existing.company,
    }
  }
}
