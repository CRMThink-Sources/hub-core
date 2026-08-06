import z from 'zod'
import {
  SubscriptionItem,
  SubscriptionItemMetadata,
} from '@/modules/application/domain/entities/subscription-item'
import {
  CreateSubscriptionItemInput,
  UpdateSubscriptionItemInput,
} from '@/modules/application/domain/repositories/subscription-item.repository'
import { env } from '@/config/env'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { parseConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { InvalidBitrixSubscriptionItemError } from '../errors/invalid-bitrix-subscription-item.error'
import {
  SUBSCRIPTION_ITEM_CHANNEL_FIELD,
  SUBSCRIPTION_ITEM_SETTINGS_FIELD,
} from '../ensure-subscription-item-settings-field'

export const SUBSCRIPTION_PARENT_FIELD =
  `parentId${env.payments.spa.subscriptionEntityType}` as const

/**
 * IDs do campo de lista `UF_CRM_93_STATUS` na SPA de itens de assinatura.
 * São `isDynamic: true`, ou seja, gerados por este portal — se a SPA for
 * recriada ou migrada, este mapa precisa ser refeito.
 *
 * Só dois valores: a SPA de itens não tem `Em teste` nem `Vencido`, porque trial
 * e inadimplência são estados da assinatura, não do item.
 */
const STATUS_BY_BITRIX_ID: Record<string, SubscriptionItem['status']> = {
  '13625': 'active', // Ativo
  '13627': 'cancelled', // Cancelado
}

/**
 * Derivado por inversão em tempo de módulo: um mapa só, impossível de
 * dessincronizar do de leitura.
 */
const BITRIX_ID_BY_STATUS = Object.fromEntries(
  Object.entries(STATUS_BY_BITRIX_ID).map(([id, status]) => [status, id]),
) as Record<SubscriptionItem['status'], string>

/**
 * ID de enum desconhecido ou ausente é erro de configuração, não motivo para
 * assumir um status default — `'active'` faria item cancelado parecer provisionado
 * e `'cancelled'` cortaria conector pago.
 */
const bitrixStatus = z
  .unknown()
  .transform((raw, ctx): SubscriptionItem['status'] => {
    const status = STATUS_BY_BITRIX_ID[String(raw)]

    if (!status) {
      ctx.addIssue({
        code: 'custom',
        message: `Status de item de assinatura desconhecido: ${JSON.stringify(raw)}`,
      })
      return z.NEVER
    }

    return status
  })

/**
 * Campo parent obrigatório. O Bitrix devolve parent como número, então coage —
 * mas `null`, `0` e string vazia são rejeitados: item sem assinatura pai não é
 * cobrável, mesma postura de `Subscription`.
 */
const bitrixRequiredRef = z
  .union([z.string().min(1), z.number()])
  .transform(String)
  .refine(value => value !== '0', {
    message: 'Referência obrigatória ausente',
  })

/**
 * Texto opcional da SPA: ausente, `null` e string vazia são o mesmo estado, e o
 * domínio só conhece ausência. Vale para `ufCrm93GatewayId` e para os quatro
 * campos de credencial.
 */
const bitrixOptionalText = z
  .string()
  .nullish()
  .transform(value => value || undefined)

/**
 * Lê o JSON de `ufCrm93Settings`.
 *
 * Degrada para os defaults em **todo** caminho de falha — campo ausente, string
 * vazia, JSON malformado, shape inesperado. Nunca lança.
 *
 * O motivo é de blast radius: este campo é cosmético (quatro toggles), mas a
 * leitura do item serve billing, lista de linhas e roteamento de mensagem. Um
 * JSON corrompido derrubando tudo isso seria trocar um toggle errado por uma
 * instalação inteira fora do ar. `parseConnectorSettings` já colapsa nulo, vazio
 * e shape inválido — aqui só falta proteger o `JSON.parse`.
 */
const parseSettingsField = (raw: unknown): ConnectorSettings => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return parseConnectorSettings(null)
  }

  try {
    return parseConnectorSettings(JSON.parse(raw))
  } catch {
    return parseConnectorSettings(null)
  }
}

/** Os quatro campos de credencial já normalizados, antes de derivar o provider. */
type CredentialFields = {
  zApiInstanceId?: string | undefined
  zApiInstanceToken?: string | undefined
  hubmessageChannelId?: string | undefined
  wabaId?: string | undefined
}

type MetadataResolution =
  | { ok: true; metadata: SubscriptionItemMetadata }
  | { ok: false; issues: Array<{ path: string[]; message: string }> }

/**
 * Deriva o provider de quais pares de credenciais estão preenchidos — a SPA 1146
 * não tem campo de provider.
 *
 * Função pura, sem `ctx`: o transform do schema converte as issues devolvidas em
 * issues do Zod, para que erro de shape e erro de credencial saiam no mesmo
 * `InvalidBitrixSubscriptionItemError`.
 *
 * Par da Z-API incompleto e provider duplo são **erro**, não caso a resolver:
 * credencial parcial não conecta nada, e escolher provider por precedência num item
 * ambíguo mandaria mensagem pelo canal errado.
 *
 * **A HubMessage não é um par.** O canal identifica a linha; a WABA só existe depois
 * de o cliente conectar o número na Meta, e chega numa requisição posterior. Exigir
 * os dois juntos tornava a linha do WhatsApp Oficial impossível de gravar — o
 * provisionamento devolve canal e nada mais. WABA **sem** canal continua erro: é
 * credencial órfã, e não identifica recurso nenhum.
 */
const resolveMetadata = (fields: CredentialFields): MetadataResolution => {
  const zApi = [fields.zApiInstanceId, fields.zApiInstanceToken]

  const zApiFilled = zApi.filter(Boolean).length
  const hasChannel = Boolean(fields.hubmessageChannelId)
  const hasWaba = Boolean(fields.wabaId)

  if (zApiFilled === 1) {
    return {
      ok: false,
      issues: [
        {
          path: ['ufCrm93ZApiInstanceId', 'ufCrm93ZApiInstanceToken'],
          message:
            'Par de credenciais da Z-API incompleto: id da instância e token têm que vir juntos',
        },
      ],
    }
  }

  if (hasWaba && !hasChannel) {
    return {
      ok: false,
      issues: [
        {
          path: ['ufCrm93HubChanelId', 'ufCrm93HubWabaId'],
          message:
            'Item com WABA e sem id do canal da HubMessage: a WABA não identifica recurso nenhum sem o canal',
        },
      ],
    }
  }

  if (zApiFilled === 2 && hasChannel) {
    return {
      ok: false,
      issues: [
        {
          path: ['ufCrm93ZApiInstanceId', 'ufCrm93HubChanelId'],
          message:
            'Item com credenciais de dois providers é ambíguo: um item de assinatura é um conector',
        },
      ],
    }
  }

  if (zApiFilled === 2) {
    return {
      ok: true,
      metadata: {
        provider: 'ZAPI',
        zApiInstanceId: fields.zApiInstanceId!,
        zApiInstanceToken: fields.zApiInstanceToken!,
      },
    }
  }

  if (hasChannel) {
    return {
      ok: true,
      metadata: {
        provider: 'HUBMESSAGE',
        hubmessageChannelId: fields.hubmessageChannelId!,
        /**
         * Omitida quando vazia, em vez de string vazia: `''` no domínio passaria por
         * toda checagem de presença e só falharia na chamada ao provider, longe daqui.
         */
        ...(fields.wabaId ? { wabaId: fields.wabaId } : {}),
      },
    }
  }

  // Nenhum dos quatro campos preenchido: item de cobrança sem conector.
  return { ok: true, metadata: { provider: 'NONE' } }
}

const bitrixSubscriptionItemSchema = z
  .object({
    id: z.coerce.string(),
    title: z.string(),
    [SUBSCRIPTION_PARENT_FIELD]: bitrixRequiredRef,
    ufCrm93Status: bitrixStatus,
    // Opcional na SPA: item ainda não espelhado no gateway não tem id.
    ufCrm93GatewayId: bitrixOptionalText,
    ufCrm93ZApiInstanceId: bitrixOptionalText,
    ufCrm93ZApiInstanceToken: bitrixOptionalText,
    ufCrm93HubChanelId: bitrixOptionalText,
    ufCrm93HubWabaId: bitrixOptionalText,
    /**
     * `unknown` e não `bitrixOptionalText`: o conteúdo é validado por
     * `parseSettingsField`, que degrada em vez de reprovar o item. Reprovar aqui
     * faria um JSON torto invalidar o item de cobrança inteiro.
     */
    [SUBSCRIPTION_ITEM_SETTINGS_FIELD]: z.unknown(),
    // Ausente, `null` e string vazia são o mesmo estado: sem canal vinculado.
    [SUBSCRIPTION_ITEM_CHANNEL_FIELD]: bitrixOptionalText,
  })
  .transform((data, ctx): SubscriptionItem => {
    const resolution = resolveMetadata({
      zApiInstanceId: data.ufCrm93ZApiInstanceId,
      zApiInstanceToken: data.ufCrm93ZApiInstanceToken,
      hubmessageChannelId: data.ufCrm93HubChanelId,
      wabaId: data.ufCrm93HubWabaId,
    })

    if (!resolution.ok) {
      for (const issue of resolution.issues) {
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        })
      }
      return z.NEVER
    }

    return {
      id: data.id,
      name: data.title,
      subscription: data[SUBSCRIPTION_PARENT_FIELD],
      status: data.ufCrm93Status,
      metadata: resolution.metadata,
      settings: parseSettingsField(data[SUBSCRIPTION_ITEM_SETTINGS_FIELD]),
      vinculatedChannel: data[SUBSCRIPTION_ITEM_CHANNEL_FIELD] ?? null,
      gatewayId: data.ufCrm93GatewayId,
    }
  })

/**
 * Puro e síncrono, sem tipo `Raw*` intermediário como em plano e assinatura:
 * o item não hidrata nenhuma outra entidade, então não há nada para o
 * repositório resolver depois do parse.
 */
export const mapBitrixSpaSubscriptionItemToSubscriptionItem = (
  raw: unknown,
): SubscriptionItem => {
  const parsed = bitrixSubscriptionItemSchema.safeParse(raw)

  if (!parsed.success) {
    throw new InvalidBitrixSubscriptionItemError(parsed.error.issues)
  }

  return parsed.data
}

export const collectBitrixSpaSubscriptionItemToSubscriptionItem = (
  raw: unknown[],
): SubscriptionItem[] => {
  return raw.map(mapBitrixSpaSubscriptionItemToSubscriptionItem)
}

/**
 * Achata `metadata` nos quatro campos da SPA conforme o provider, escrevendo
 * **string vazia** nos campos do outro provider para que credencial obsoleta não
 * permaneça no item depois de uma troca de conector.
 *
 * É a única exceção à regra de "campo ausente é omitido" — e ela se aplica a
 * `metadata` como um todo, nunca a campo individual: quem manda `metadata` está
 * declarando o conector inteiro do item.
 */
const metadataToBitrixFields = (
  metadata: SubscriptionItemMetadata,
): Record<string, unknown> => {
  const empty = {
    ufCrm93ZApiInstanceId: '',
    ufCrm93ZApiInstanceToken: '',
    ufCrm93HubChanelId: '',
    ufCrm93HubWabaId: '',
  }

  switch (metadata.provider) {
    case 'ZAPI':
      return {
        ...empty,
        ufCrm93ZApiInstanceId: metadata.zApiInstanceId,
        ufCrm93ZApiInstanceToken: metadata.zApiInstanceToken,
      }
    case 'HUBMESSAGE':
      return {
        ...empty,
        ufCrm93HubChanelId: metadata.hubmessageChannelId,
        /**
         * String vazia, e não omissão: `metadata` é gravado como bloco, então omitir
         * aqui deixaria a WABA de um canal anterior sobreviver a uma troca de canal.
         */
        ufCrm93HubWabaId: metadata.wabaId ?? '',
      }
    case 'NONE':
      return empty
  }
}

/**
 * Domínio → campos da SPA, para `crm.item.add` e `crm.item.update`.
 * Campo ausente na entrada é **omitido** do payload, nunca enviado como `null`
 * — sem isso, `updateSubscriptionItem` apagaria os campos que o patch não
 * menciona.
 */
export const mapSubscriptionItemInputToBitrixFields = (
  input: Partial<CreateSubscriptionItemInput> | UpdateSubscriptionItemInput,
): Record<string, unknown> => {
  const fields: Record<string, unknown> = {}

  if (input.name !== undefined) fields.title = input.name
  if (input.status !== undefined) {
    fields.ufCrm93Status = BITRIX_ID_BY_STATUS[input.status]
  }
  if (input.gatewayId !== undefined) {
    fields.ufCrm93GatewayId = input.gatewayId
  }
  if (input.metadata !== undefined) {
    Object.assign(fields, metadataToBitrixFields(input.metadata))
  }
  /**
   * Serializa o objeto **completo** de quatro chaves, nunca um patch. É o que
   * permite que a leitura seja burra: no dado persistido não existe "chave
   * ausente herda do anterior". O merge parcial é responsabilidade de quem chama,
   * antes de chegar aqui.
   *
   * Ausente no input é **omitido**, como todo campo: patch que não menciona
   * settings não pode apagar a configuração do cliente.
   */
  if (input.settings !== undefined) {
    fields[SUBSCRIPTION_ITEM_SETTINGS_FIELD] = JSON.stringify(input.settings)
  }
  /**
   * `null` vira **string vazia**, não campo omitido: desvincular canal é uma
   * escrita, e omitir manteria o vínculo antigo. Omissão continua significando
   * "não mexe", e é o que acontece quando a chave não vem no input.
   */
  if (input.vinculatedChannel !== undefined) {
    fields[SUBSCRIPTION_ITEM_CHANNEL_FIELD] = input.vinculatedChannel ?? ''
  }
  // Só o caminho de criação carrega `subscription`: `UpdateSubscriptionItemInput`
  // omite o campo, e o mapper não o reintroduz.
  if ('subscription' in input && input.subscription !== undefined) {
    fields[SUBSCRIPTION_PARENT_FIELD] = input.subscription
  }

  return fields
}
