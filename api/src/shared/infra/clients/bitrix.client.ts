/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Credential } from '@/shared/domain/entities/credential'
import axios from 'axios'
import { getBitrixAxiosDefaults } from './bitrix-axios-config'
import { BitrixError } from './errors/bitrix-client.error'
import {
  formatBitrixApiError,
  wrapBitrixRequestError,
} from './bitrix-http-errors'
import { normalizeBitrixDomain } from './normalize-bitrix-domain'
import { resolveOpenChannelContactId } from '@/shared/helpers/open-channel-contact-id'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { attachBitrixLimits } from '@/shared/infra/bitrix-limits/attach-bitrix-limits'
import { PlacementHandlerEntry } from '@/modules/thinkzap/application/normalize-placement-get-response'

/** `entityTypeId` da entidade Empresa no `crm.item.*`. */
const COMPANY_ENTITY_TYPE_ID = 4

interface IBitrixClientParams {
  bitrixCredential?: Credential
  domain?: string
  webhook?: string
  accessToken?: string
}

export class BitrixClient {
  private readonly bitrixCredential?: Credential
  private readonly domain?: string
  private readonly webhook?: string
  private readonly accessToken?: string

  constructor(params: IBitrixClientParams) {
    this.bitrixCredential = params.bitrixCredential
    this.domain = params.domain
      ? normalizeBitrixDomain(params.domain)
      : params.domain
    this.webhook = params.webhook
    this.accessToken = params.accessToken
  }

  static withUserToken(domain: string, accessToken: string): BitrixClient {
    return new BitrixClient({ domain, accessToken })
  }

  getClient() {
    const axiosDefaults = getBitrixAxiosDefaults()

    if (this.webhook) {
      /**
       * Webhook de entrada nao identifica portal: sem `domain`, `attachBitrixLimits`
       * devolve a instancia intacta em vez de misturar baldes de instalacoes.
       */
      return attachBitrixLimits(
        axios.create({
          baseURL: this.webhook,
          ...axiosDefaults,
        }),
        this.domain,
      )
    }
    if (this.accessToken && this.domain) {
      return attachBitrixLimits(
        axios.create({
          baseURL: `https://${this.domain}/rest/`,
          params: {
            auth: this.accessToken,
          },
          ...axiosDefaults,
        }),
        this.domain,
      )
    }
    if (!this.bitrixCredential || !this.domain) {
      throw new Error('Bitrix credential and domain are required')
    }
    return attachBitrixLimits(
      axios.create({
        baseURL: `https://${this.domain}/rest/`,
        params: {
          auth: this.bitrixCredential.accessToken,
        },
        ...axiosDefaults,
      }),
      this.domain,
    )
  }

  async activateConnector(line: number, connector: string, active: number = 1) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.activate', {
        LINE: line,
        CONNECTOR: connector,
        ACTIVE: active,
      })

      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to activate connector'
      throw new BitrixError(message)
    }
  }

  async callMethod<T = unknown>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const client = this.getClient()
    try {
      const response = await client.post(`/${method}`, params)
      return response.data as T
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      if (error instanceof Error) {
        console.log(error)
      }
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : `Failed to call Bitrix method: ${method}`
      throw new BitrixError(message)
    }
  }

  async sendMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.send.messages', data)
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to create conversation'
      throw new BitrixError(message)
    }
  }

  async updateMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.update.messages', data)
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to update message'
      throw new BitrixError(message)
    }
  }

  async deleteMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.delete.messages', data)
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to delete message'
      throw new BitrixError(message)
    }
  }

  async getChat(chatId: string) {
    const client = this.getClient()
    try {
      const response = await client.get(`/im.dialog.get?DIALOG_ID=${chatId}`)
      return response.data.result
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to get chat'
      throw new BitrixError(message)
    }
  }

  async getLastMessageId(chatId: string): Promise<string | null> {
    const client = this.getClient()
    try {
      const response = await client.get<{ result?: IDialogGetResult }>(
        '/im.dialog.get',
        { params: { DIALOG_ID: `chat${chatId}` } },
      )
      const lastMessageId = response.data?.result?.last_message_id
      return lastMessageId != null ? String(lastMessageId) : null
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const wrapped = wrapBitrixRequestError('im.dialog.get', error)
      console.error('[BitrixClient] getLastMessageId error:', wrapped.message)
      return null
    }
  }

  async setMessageDelivered(data: ISetMessageDeliveredData) {
    const client = this.getClient()
    try {
      const response = await client.post(
        '/imconnector.send.status.delivery',
        data,
      )
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] setMessageDelivered error:', error)
    }
  }

  async getOpenChannel(id: string): Promise<IGetOpenChannelResponse> {
    const client = this.getClient()
    try {
      const response = await client.post('/imopenlines.config.get', {
        CONFIG_ID: id,
      })
      return response.data.result
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const wrapped = wrapBitrixRequestError('imopenlines.config.get', error)
      throw new BitrixError(wrapped.message)
    }
  }

  async getOpenChannels(): Promise<IGetOpenChannelsResponse> {
    const client = this.getClient()
    try {
      const response = await client.post('/imopenlines.config.list.get', {})
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const wrapped = wrapBitrixRequestError(
        'imopenlines.config.list.get',
        error,
      )
      throw new BitrixError(wrapped.message)
    }
  }

  async getCrmItem(
    entityTypeId: number,
    id: string,
  ): Promise<ICrmItemResponse> {
    const client = this.getClient()
    try {
      const response = await client.get<ICrmItemResponse>(`/crm.item.get`, {
        params: { entityTypeId, id },
      })
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      throw new BitrixError('Failed to get CRM item')
    }
  }

  /**
   * Descreve os campos de uma SPA. Serve para verificar que um campo custom
   * existe **antes** de escrever nele: `crm.item.update` ignora campo desconhecido
   * sem devolver erro, então gravar num campo inexistente é perda silenciosa.
   */
  async getCrmItemFields(
    entityTypeId: number,
  ): Promise<ICrmItemFieldsResponse> {
    const client = this.getClient()
    try {
      const response = await client.get<ICrmItemFieldsResponse>(
        `/crm.item.fields`,
        { params: { entityTypeId } },
      )
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] getCrmItemFields error:', error)
      throw new BitrixError('Failed to describe CRM item fields')
    }
  }

  async listCrmItems(
    entityTypeId: number,
    filter: Record<string, unknown>,
    options?: { select?: string[]; start?: number },
  ): Promise<ICrmItemListResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.list`, {
        entityTypeId,
        filter,
        ...(options?.select ? { select: options.select } : {}),
        // `start` só vai quando pedido: o Bitrix trata ausência como primeira página, e
        // mandar `0` explicitamente não muda nada — mas mandar `undefined` sim.
        ...(options?.start !== undefined ? { start: options.start } : {}),
      })
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] listCrmItems error:', error)
      throw new BitrixError('Failed to list CRM items')
    }
  }

  async createCrmItem(
    entityTypeId: number,
    fields: Record<string, unknown>,
  ): Promise<ICrmItemCreateResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.add`, {
        entityTypeId,
        fields,
      })
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] createCrmItem error:', error)
      throw new BitrixError('Failed to create CRM item')
    }
  }

  async updateCrmItem(
    entityTypeId: number,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<ICrmItemUpdateResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.update`, {
        entityTypeId,
        id,
        fields,
      })
      return response.data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] updateCrmItem error:', error)
      throw new BitrixError('Failed to update CRM item')
    }
  }

  async getDealContactIds(dealId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.deal.contact.items.get`, {
        id: dealId,
      })
      const result = (response.data as { result?: unknown })?.result
      if (!Array.isArray(result)) return []
      return (result as { CONTACT_ID: number | string }[]).map(item =>
        String(item.CONTACT_ID),
      )
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] getDealContactIds error:', error)
      throw new BitrixError('Failed to get deal contact ids')
    }
  }

  /**
   * Contatos ligados ao lead pela seção "Cliente".
   *
   * `crm.lead.contact.items.get` é o método canônico do vínculo múltiplo — o campo
   * `contactId` do item traz só o contato principal em portal antigo. O chamador
   * mantém o fallback pelos campos do item para o caso desta chamada falhar.
   */
  async getLeadContactIds(leadId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.lead.contact.items.get`, {
        id: leadId,
      })
      const result = (response.data as { result?: unknown })?.result
      if (!Array.isArray(result)) return []
      return (result as { CONTACT_ID: number | string }[]).map(item =>
        String(item.CONTACT_ID),
      )
    } catch (error) {
      console.error('[BitrixClient] getLeadContactIds error:', error)
      throw new BitrixError('Failed to get lead contact ids')
    }
  }

  /**
   * Contatos ligados a uma empresa, pelo vínculo múltiplo `contactIds` do item.
   *
   * `crm.company.contact.list` — método usado aqui antes — não existe no REST do
   * Bitrix: a chamada voltava `ERROR_METHOD_NOT_FOUND` e todo chamador tratava a
   * falha como "empresa sem contatos", zerando os contatos da empresa em Deal,
   * Lead, Contato e SPA dinâmica. `crm.item.get` no `entityTypeId` 4 devolve o
   * vínculo completo em `contactIds`.
   */
  async getCompanyContactIds(companyId: string): Promise<string[]> {
    try {
      const {
        result: { item },
      } = await this.getCrmItem(COMPANY_ENTITY_TYPE_ID, companyId)

      const contactIds = item?.contactIds
      if (!Array.isArray(contactIds)) return []

      const ids: string[] = []
      for (const raw of contactIds) {
        if (typeof raw === 'number') ids.push(String(raw))
        else if (typeof raw === 'string' && raw) ids.push(raw)
      }
      return Array.from(new Set(ids))
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] getCompanyContactIds error:', error)
      throw new BitrixError('Failed to get company contact ids')
    }
  }

  async getPlacementHandlers(): Promise<
    PlacementHandlerEntry[] | { result?: PlacementHandlerEntry[] }
  > {
    const client = this.getClient()
    try {
      const response = await client.post('/placement.get', {})
      const data = response.data as {
        error?: string
        error_description?: string
        result?: PlacementHandlerEntry[]
      }

      if (data.error) {
        throw new BitrixError(
          formatBitrixApiError(
            'placement.get',
            data.error,
            data.error_description,
          ),
        )
      }

      return data.result ?? data
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      console.error('[BitrixClient] getPlacementHandlers error:', error)
      if (error instanceof BitrixError) {
        throw error
      }

      const wrapped = wrapBitrixRequestError('placement.get', error)
      throw new BitrixError(wrapped.message)
    }
  }

  /**
   * Posta no canal aberto do Bitrix uma mensagem que o CRM acabou de enviar ao
   * contato, abrindo (ou reusando) a sessão daquele contato.
   *
   * **A identidade chega pronta.** Este método canonizava o telefone por conta própria,
   * o que era certo enquanto a identidade *era* um telefone. Deixou de ser: em linha
   * Z-API ela é o LID, resolvido por uma cadeia que precisa do mapa e, no pior caso, de
   * uma consulta à Z-API — nada que caiba dentro de um cliente HTTP do Bitrix. Quem
   * resolve é o chamador, que sabe o provider da linha.
   *
   * **Identidade, nome e telefone são três valores.** Os cinco campos abaixo recebiam
   * todos o mesmo: `chat.id`, `chat.name`, `user.id`, `user.name` e `user.phone`. Com
   * identidade de telefone isso passava despercebido; com identidade de LID, o
   * identificador interno do WhatsApp viraria o nome do contato na tela do operador e o
   * telefone dele no CRM.
   *
   * `phone` ausente é estado válido — contato em modo privacidade não tem número — e é
   * por isso que ele é omitido em vez de mandado vazio.
   */
  async sendToOpenChannel(
    lineId: string,
    connectorCode: string,
    contact: {
      /** `chat.id`/`user.id` — já resolvido pelo chamador. */
      id: string
      /** O que o operador lê. Nunca um LID. */
      name: string
      /** Telefone real, ou `null` quando o contato não tem um conhecido. */
      phone: string | null
    },
    message: string,
    /**
     * Vai antes da mensagem no histórico. Parâmetro porque o cliente é compartilhado e não
     * conhece idioma de instalação: o chamador do ThinkZap passa o traduzido.
     */
    prefix = '[Mensagem enviada a partir do CRM]\n',
  ): Promise<{
    chatId: string | null
    bitrixMessageId: string | null
    payload: ISendMessageData
  }> {
    const contactId = contact.id
    const messageId = `widget_${Date.now()}_${contactId}`
    const params: ISendMessageData = {
      CONNECTOR: connectorCode,
      LINE: Number(lineId),
      MESSAGES: [
        {
          chat: { id: contactId, name: contact.name },
          user: {
            id: contactId,
            name: contact.name,
            last_name: '',
            ...(contact.phone ? { phone: contact.phone } : {}),
          },
          message: {
            id: messageId,
            date: new Date().toISOString(),
            text: prefix + message,
          },
        },
      ],
    }
    const client = this.getClient()
    try {
      const response = await client.post<{
        result?: {
          DATA?: {
            RESULT?: Array<{
              session?: { CHAT_ID?: string | number }
              message?: { id?: string | number }
            }>
          }
        }
      }>('/imconnector.send.messages', params)
      const result = response.data?.result?.DATA?.RESULT?.[0]
      const rawChatId = result?.session?.CHAT_ID
      const rawMsgId = result?.message?.id
      const chatId = rawChatId != null ? String(rawChatId) : null
      const bitrixMessageId = rawMsgId != null ? String(rawMsgId) : null
      return { chatId, bitrixMessageId, payload: params }
    } catch (error) {
      // Pausa por OPERATION_TIME_LIMIT tem que chegar inteira em quem chamou: e o
      // `untilMs` dela que diz quando reagendar. Envolver viraria erro genérico.
      if (error instanceof BitrixMethodPausedError) throw error

      const msg =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to create open channel conversation'
      throw new BitrixError(msg)
    }
  }
}

export interface ICrmItemResponse {
  result: {
    item: Record<string, unknown>
  }
}

export interface ICrmItemFieldsResponse {
  result: {
    fields: Record<string, { type?: string; isReadOnly?: boolean }>
  }
}

export interface ICrmItemListResponse {
  result: {
    items: {
      id: string
    }[]
  }
  /**
   * O `start` da página seguinte. **Ausente na última página** — é assim que o Bitrix
   * sinaliza o fim, e é por isso que quem pagina para no `undefined` em vez de comparar
   * com `total`.
   *
   * A maioria das leituras daqui ignora este campo de propósito: elas filtram por pai ou
   * por id e caberiam sempre na primeira página. Quem varre a SPA inteira — backfill —
   * precisa dele, e sem ele cobriria só os 50 primeiros itens em silêncio.
   */
  next?: number
  total?: number
}

export interface ICrmItemCreateResponse {
  result: {
    item: {
      id: string
    }
  }
}

export interface ICrmItemUpdateResponse {
  result: {
    id: string
  }
}
export interface IGetOpenChannelResponse {
  LINE_NAME: string
  /** Expediente do canal — formatos em `isWithinWorkingHours`. */
  WORKTIME_ENABLE?: string
  WORKTIME_FROM?: string
  WORKTIME_TO?: string
  WORKTIME_TIMEZONE?: string
  WORKTIME_DAYOFF?: string[]
  WORKTIME_HOLIDAYS?: string[]
}

export interface ISendMessageData {
  CONNECTOR: string
  LINE: number
  MESSAGES: {
    user: {
      id: string
      name: string
      last_name: string
      /**
       * Telefone do contato no CRM. **Opcional**: contato em modo privacidade não tem
       * telefone conhecido, e o campo tem que ser omitido em vez de receber o LID ou os
       * dígitos extraídos dele — o Bitrix grava este valor como telefone do contato, e
       * o operador disca por ele.
       */
      phone?: string
      picture?: {
        url: string
      }
    }
    message: {
      id: string
      date: string
      text: string
      files?: {
        url: string
        name: string
      }[]
    }
    chat: {
      id: string
      name: string
    }
  }[]
}

interface ISetMessageDeliveredData {
  CONNECTOR: string
  LINE: string
  MESSAGES: {
    im: any
    message: {
      id: string
    }
    chat: {
      id: string
    }
  }[]
}

export interface IDialogGetResult {
  last_message_id?: number
  entity_type?: string
  entity_id?: string
}

export interface IGetOpenChannelsResponse {
  result: {
    LINE_NAME: string
    ACTIVE: string
    ID: string
  }[]
}
