import axios, { AxiosInstance } from 'axios'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { SubscribeOutcome } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { attachProviderHttpLogging } from '@/shared/infra/clients/provider-http-logging'
import {
  ConnectHubMessageChannelParams,
  CreateHubMessageChannelParams,
  CreateHubMessageChannelResponse,
  CreateHubMessageWebhookParams,
  CreateHubMessageWebhookResponse,
  CreateTemplateParams,
  CreateTemplateResponse,
  UploadTemplateMediaResponse,
  HubMessageBusiness,
  HubMessageWebhook,
  ListBusinessesResponse,
  ListTemplatesResponse,
  SendHubMessageInteractiveActionParams,
  SendHubMessageInteractiveActionResponse,
  SendHubMessageInteractiveButtonParams,
  SendHubMessageInteractiveButtonResponse,
  SendHubMessageParams,
  SendHubMessageResponse,
  SendHubMessageTemplateParams,
  SendHubMessageTemplateResponse,
  SyncTemplatesResponse,
  UpdateHubMessageWebhookParams,
} from './types/hubmessage.types'

export type HubMessageClientConfig = {
  baseUrl: string
  token: string
}

/**
 * Erro da API HubMessage com status e corpo da resposta preservados — o
 * `AxiosError` cru esconde o `message` retornado pela API (ex.: 422 de regra de
 * negócio), o que torna o diagnóstico impossível a partir do log.
 */
export class HubMessageApiError extends Error {
  constructor(
    readonly status: number | undefined,
    readonly method: string,
    readonly url: string,
    readonly body: unknown,
    readonly cause: unknown,
  ) {
    super(
      `HubMessage: ${method} ${url} falhou com status ${status ?? 'desconhecido'} — ${JSON.stringify(body)}`,
    )
    this.name = 'HubMessageApiError'
  }
}

/**
 * Cliente REST da HubMessage (WhatsApp Oficial). Credenciais vêm da configuração
 * de ambiente; nada é hardcoded. Base: `https://api.hubmessage.io`.
 */
/** A resposta da HubMessage para subscribe em canal que já está pago. */
export function isHubMessageAlreadyPaid(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  return isAlreadyPaidBody(error.response?.data)
}

/** O mesmo corpo `ALREADY_PAID` pode vir num `200` — aí é a resposta, não um erro. */
function isAlreadyPaidBody(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'ALREADY_PAID'
  )
}

export class HubMessageClient {
  private readonly http: AxiosInstance

  constructor(config: HubMessageClientConfig) {
    if (!config.token) {
      throw thinkzapError('thinkzap.hubmessage.not_configured')
    }
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ''),
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    })
    /**
     * Antes do interceptor de tradução abaixo: o log precisa ver o `AxiosError` cru,
     * com `response.data` intacto. Registrado depois, ele receberia o
     * `HubMessageApiError` já embrulhado e perderia o corpo — que é onde a HubMessage
     * diz o motivo real da recusa.
     */
    attachProviderHttpLogging(this.http, 'HUBMESSAGE')

    this.http.interceptors.response.use(undefined, (error: unknown) => {
      if (axios.isAxiosError(error)) {
        throw new HubMessageApiError(
          error.response?.status,
          error.config?.method?.toUpperCase() ?? 'REQUEST',
          error.config?.url ?? '',
          error.response?.data,
          error,
        )
      }
      throw error
    })
  }

  async createChannel(
    params: CreateHubMessageChannelParams,
  ): Promise<CreateHubMessageChannelResponse> {
    const { data } = await this.http.post<CreateHubMessageChannelResponse>(
      '/v1/channels',
      params,
    )
    return data
  }

  async createWebhook(
    channelId: string,
    params: CreateHubMessageWebhookParams,
  ): Promise<CreateHubMessageWebhookResponse> {
    const { data } = await this.http.post<CreateHubMessageWebhookResponse>(
      `/v1/channels/${channelId}/webhooks`,
      params,
    )
    return data
  }

  async listWebhooks(channelId: string): Promise<HubMessageWebhook[]> {
    const { data } = await this.http.get<HubMessageWebhook[]>(
      `/v1/channels/${channelId}/webhooks`,
    )
    return data
  }

  async updateWebhook(
    channelId: string,
    webhookId: string,
    params: UpdateHubMessageWebhookParams,
  ): Promise<HubMessageWebhook> {
    const { data } = await this.http.patch<HubMessageWebhook>(
      `/v1/channels/${channelId}/webhooks/${webhookId}`,
      params,
    )
    return data
  }

  async connectChannel(
    channelId: string,
    params: ConnectHubMessageChannelParams,
  ): Promise<void> {
    await this.http.post(`/v1/channels/${channelId}/connect`, params)
  }

  /**
   * Envia mensagem livre ao contato. Só é aceita enquanto a janela de conversa
   * de 24h estiver aberta; fora dela a API rejeita e apenas um template passa.
   */
  async sendMessage(
    channelId: string,
    params: SendHubMessageParams,
  ): Promise<SendHubMessageResponse> {
    const { data } = await this.http.post<SendHubMessageResponse>(
      `/v1/channels/${channelId}/messages`,
      params,
    )
    return data
  }

  /**
   * Envia um template aprovado ao contato. Diferente de `sendMessage`, **não**
   * depende da janela de conversa de 24h — template é justamente o que reabre a
   * conversa fora dela.
   *
   * Mesma rota do envio livre; o que muda é `content`. O shape tem três armadilhas
   * não documentadas (template dentro de `attachments`, `language` como objeto,
   * `type` maiúsculo) — ver `SendHubMessageTemplateParams`.
   */
  async sendTemplateMessage(
    channelId: string,
    params: SendHubMessageTemplateParams,
  ): Promise<SendHubMessageTemplateResponse> {
    const { data } = await this.http.post<SendHubMessageTemplateResponse>(
      `/v1/channels/${channelId}/messages`,
      params,
    )
    return data
  }

  /**
   * Envia mensagem com botões de ação. Mesma rota do envio livre e do
   * template; o que muda é `content`. Assim como o envio livre, só é aceita
   * enquanto a janela de conversa de 24h estiver aberta.
   */
  async sendInteractiveAction(
    channelId: string,
    params: SendHubMessageInteractiveActionParams,
  ): Promise<SendHubMessageInteractiveActionResponse> {
    const { data } =
      await this.http.post<SendHubMessageInteractiveActionResponse>(
        `/v1/channels/${channelId}/messages`,
        params,
      )
    return data
  }

  /**
   * Envia mensagem com resposta rápida. Mesma rota do envio livre, mas
   * `content.type = 'INTERACTIVE_BUTTON'` — formato diferente de
   * `sendInteractiveAction` (sem `header`/`footer`), não um `content.type`
   * alternativo do mesmo corpo. Ver `SendHubMessageInteractiveButtonParams`.
   */
  async sendInteractiveButton(
    channelId: string,
    params: SendHubMessageInteractiveButtonParams,
  ): Promise<SendHubMessageInteractiveButtonResponse> {
    const { data } =
      await this.http.post<SendHubMessageInteractiveButtonResponse>(
        `/v1/channels/${channelId}/messages`,
        params,
      )
    return data
  }

  /**
   * Assinar canal **já pago** é sucesso, não falha. A HubMessage responde
   * `{ type: 'ALREADY_PAID', message: 'Instância já está ativa.' }` (confirmado em
   * 2026-10-13); se vier como erro HTTP, é engolido aqui. Os gatilhos da SPA dependem
   * disto: linha assinada antes da marca de assinado existir recebe um subscribe
   * repetido no primeiro UPDATE.
   */
  async subscribeChannel(channelId: string): Promise<SubscribeOutcome> {
    try {
      const { data } = await this.http.get<unknown>(
        `/v1/channels/${channelId}/subscribe`,
      )
      return isAlreadyPaidBody(data) ? 'already-subscribed' : 'subscribed'
    } catch (error) {
      if (isHubMessageAlreadyPaid(error)) return 'already-subscribed'
      throw error
    }
  }

  async disconnectChannel(channelId: string): Promise<void> {
    await this.http.put(`/v1/channels/${channelId}/disconnect`, {})
  }

  /**
   * Cancela a assinatura do canal. A query `cancel=true` é obrigatória: sem ela a
   * HubMessage não cancela. A resposta é `204` também para canal já cancelado ou nunca
   * assinado (confirmado em 2026-10-13), então repetir o cancelamento é seguro.
   */
  async cancelChannel(channelId: string, cancelReason: string): Promise<void> {
    await this.http.delete(`/v1/channels/${channelId}/cancel`, {
      params: { cancel: true },
      data: { cancelReason },
    })
  }

  /**
   * Lista as WABAs do token com contadores de canais conectados/desconectados.
   * A API não expõe status por canal; este agregado por WABA é a única leitura
   * de conexão ao vivo disponível.
   */
  async listBusinesses(): Promise<ListBusinessesResponse> {
    const { data } = await this.http.get<
      ListBusinessesResponse | HubMessageBusiness[]
    >('/whatsapp/businesses')
    // Defensivo: aceita tanto `{ items: [...] }` quanto array cru.
    return Array.isArray(data) ? { items: data } : data
  }

  /** Lista os templates de uma WABA. */
  async listTemplates(wabaId: string): Promise<ListTemplatesResponse> {
    const { data } = await this.http.get<ListTemplatesResponse>(
      `/whatsapp/businesses/${wabaId}/templates`,
    )
    return data
  }

  /** Cria um template e submete à aprovação da Meta (status inicial PENDING). */
  async createTemplate(
    wabaId: string,
    params: CreateTemplateParams,
  ): Promise<CreateTemplateResponse> {
    const { data } = await this.http.post<CreateTemplateResponse>(
      `/whatsapp/businesses/${wabaId}/templates`,
      params,
    )
    return data
  }

  /**
   * Sobe a imagem de exemplo de um template e devolve o identificador (`h`) para
   * `example.header_handle`. Multipart (`file` + `type`). O `h` expira: tem de ser
   * usado no `createTemplate` logo em seguida. Sem App ID/App Secret da Meta no
   * painel da Omni responde `422 MISSING_APP_CREDENTIALS`.
   * Ref.: https://developer.omni.z-api.io/templates/upload-media
   */
  async uploadTemplateMedia(
    wabaId: string,
    file: { data: Buffer; contentType: string; fileName: string },
  ): Promise<UploadTemplateMediaResponse> {
    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(file.data)], { type: file.contentType }),
      file.fileName,
    )
    form.append('type', file.contentType)

    const { data } = await this.http.post<UploadTemplateMediaResponse>(
      `/whatsapp/businesses/${wabaId}/templates/media`,
      form,
      /**
       * A instância nasce com `Content-Type: application/json`, e com ele o axios
       * serializaria o `FormData` como JSON. Declarar multipart faz o axios gerar
       * o corpo e o `boundary`.
       */
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  }

  /** Força sincronização de status dos templates de uma WABA com a Meta. */
  async syncTemplates(wabaId: string): Promise<SyncTemplatesResponse> {
    const { data } = await this.http.post<SyncTemplatesResponse>(
      `/whatsapp/businesses/${wabaId}/templates/sync`,
      {},
    )
    return data
  }
}
