import axios, { AxiosInstance } from 'axios'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  ConnectHubMessageChannelParams,
  CreateHubMessageChannelParams,
  CreateHubMessageChannelResponse,
  CreateHubMessageWebhookParams,
  CreateHubMessageWebhookResponse,
  CreateTemplateParams,
  CreateTemplateResponse,
  HubMessageBusiness,
  ListBusinessesResponse,
  ListTemplatesResponse,
  SendHubMessageParams,
  SendHubMessageResponse,
  SendHubMessageTemplateParams,
  SendHubMessageTemplateResponse,
  SyncTemplatesResponse,
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

  async subscribeChannel(channelId: string): Promise<void> {
    await this.http.get(`/v1/channels/${channelId}/subscribe`)
  }

  async disconnectChannel(channelId: string): Promise<void> {
    await this.http.put(`/v1/channels/${channelId}/disconnect`, {})
  }

  async cancelChannel(channelId: string, cancelReason: string): Promise<void> {
    await this.http.delete(`/v1/channels/${channelId}/cancel`, {
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

  /** Força sincronização de status dos templates de uma WABA com a Meta. */
  async syncTemplates(wabaId: string): Promise<SyncTemplatesResponse> {
    const { data } = await this.http.post<SyncTemplatesResponse>(
      `/whatsapp/businesses/${wabaId}/templates/sync`,
      {},
    )
    return data
  }
}
