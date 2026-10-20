import axios from 'axios'
import {
  AddGroupParticipantsParams,
  CreateGroupParams,
  CreateGroupResponse,
  CreateZApiInstanceParams,
  CreateZApiInstanceResponse,
  InstanceDataResponse,
  InstanceStatusResponse,
  LeaveGroupParams,
  ListZApiInstancesResponse,
  PhoneDataResponse,
  RemoveGroupParticipantsParams,
  UpdateGroupDescriptionParams,
  UpdateGroupNameParams,
  UpdateGroupPhotoParams,
  ZApiBooleanResponse,
  PhoneExistsResponse,
  ProfilePictureResponse,
  SendButtonActionsParams,
  ZApiGroupListItem,
  ZApiGroupMetadata,
  ZApiListResponse,
} from './types/z-api.types'
import { UpdateInstanceGateway } from '../../domain/repositories/update-instance.gateway'
import { logThinkzapError, thinkzapError } from '../../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { attachProviderHttpLogging } from '@/shared/infra/clients/provider-http-logging'

// Prova de aceite (não de entrega) para o suporte Z-API via `messageId`. Nunca logar o token.
function logZApiSend(
  operation: string,
  instanceId: string,
  phone: string,
  response: { zaapId?: string; messageId?: string; id?: string },
): void {
  apiLogger.info(
    {
      app: 'thinkzap',
      provider: 'ZAPI',
      operation,
      instanceId,
      phone,
      zaapId: response.zaapId,
      messageId: response.messageId,
      zApiId: response.id,
      // 200 sem `messageId`: a tipagem não admite, mas a rede produz.
      missingMessageId: !response.messageId,
    },
    'Z-API aceitou o envio',
  )
}

/** A resposta da Z-API para subscribe em instância que já tem assinatura paga. */
export function isZApiAlreadySubscribed(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const data: unknown = error.response?.data

  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { subscriptionStatus?: unknown }).subscriptionStatus ===
      'ALREADY_ACTIVE'
  )
}

export class ZApiClient {
  private readonly zApiToken: string
  private readonly clientToken: string | null = null

  // Instância própria: interceptor no axios global instrumentaria Bitrix/Stripe/Google também.
  private readonly http = axios.create()

  constructor(zApiToken: string, clientToken: string | null = null) {
    this.zApiToken = zApiToken
    this.clientToken = clientToken

    attachProviderHttpLogging(this.http, 'ZAPI')
  }

  async createInstance(
    params: CreateZApiInstanceParams,
  ): Promise<CreateZApiInstanceResponse> {
    try {
      const { data } = await this.http.post<CreateZApiInstanceResponse>(
        'https://api.z-api.io/instances/integrator/on-demand',
        params,
        {
          headers: {
            Authorization: `Bearer ${this.zApiToken}`,
            'Content-Type': 'application/json',
          },
        },
      )

      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_create_failed', error)
    }
  }

  /**
   * Assinar instância **já assinada** é sucesso, não falha. A Z-API responde
   * `{ subscriptionStatus: 'ALREADY_ACTIVE', error: 'there is already a paid subscription
   * for this instance' }` (confirmado em 2026-10-13), e o estado que o chamador quer —
   * instância paga — já vale. Os gatilhos da SPA dependem disto: linha assinada antes da
   * marca de assinado existir recebe um subscribe repetido no primeiro UPDATE, e tratar
   * isso como falha deixaria o job retentando até esgotar.
   */
  async subscribe(id: string, token: string): Promise<void> {
    try {
      await this.http.post(
        `https://api.z-api.io/instances/${id}/token/${token}/integrator/on-demand/subscription`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.zApiToken}`,
          },
        },
      )
    } catch (error) {
      if (isZApiAlreadySubscribed(error)) {
        apiLogger.info(
          { app: 'thinkzap', provider: 'ZAPI', instanceId: id },
          'Instância já assinada na Z-API — subscribe tratado como concluído',
        )
        return
      }
      throw thinkzapError('thinkzap.zapi.instance_subscribe_failed', error)
    }
  }

  /**
   * Agenda o cancelamento da assinatura on-demand para o fim do período. A Z-API
   * responde `200` com `{ due, id, token }` — `due` é o fim do período pago, em epoch
   * ms — também para instância já cancelada (confirmado em 2026-10-13), então repetir
   * o cancelamento é seguro e não há resposta de "já cancelado" a tratar.
   */
  async unsubscribe(id: string, token: string): Promise<void> {
    try {
      const { data } = await this.http.post<void>(
        `https://api.z-api.io/instances/${id}/token/${token}/integrator/on-demand/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.zApiToken}`,
          },
        },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_unsubscribe_failed', error)
    }
  }

  async updateInstance(
    instanceId: string,
    name: string,
    token: string,
  ): Promise<void> {
    try {
      const { data } = await this.http.put<void>(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/update-name`,
        {
          value: name,
        },
        {
          headers: {
            'Client-Token': this.clientToken,
          },
        },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_update_failed', error)
    }
  }

  /**
   * Liga ou desliga a entrega, no `ReceivedCallback`, das mensagens enviadas pelo
   * próprio número — inclusive as do celular e do WhatsApp Web (`fromApi=false`).
   * Sem isso a Z-API nem manda o evento, e o espelhamento no canal aberto não tem o
   * que espelhar.
   */
  async updateNotifySentByMe(
    instanceId: string,
    token: string,
    enabled: boolean,
  ): Promise<void> {
    try {
      await this.http.put(
        `${this.instanceBaseUrl(instanceId, token)}/update-notify-sent-by-me`,
        { notifySentByMe: enabled },
        {
          headers: {
            'Client-Token': this.clientToken,
          },
        },
      )
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.notify_sent_by_me_failed', error)
    }
  }

  async listInstances(): Promise<ListZApiInstancesResponse> {
    try {
      const { data } = await this.http.get<ListZApiInstancesResponse>(
        'https://api.z-api.io/instances/instances',
        {
          headers: {
            Authorization: `Bearer ${this.zApiToken}`,
            'Content-Type': 'application/json',
          },
        },
      )

      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_list_failed', error)
    }
  }

  async getInstance(
    instanceId: string,
    token: string,
  ): Promise<InstanceDataResponse> {
    try {
      const { data } = await this.http.get<InstanceDataResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/me`,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )

      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_get_failed', error)
    }
  }

  async getInstanceStatus(
    instanceId: string,
    token: string,
  ): Promise<InstanceStatusResponse> {
    try {
      const { data } = await this.http.get<InstanceStatusResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )

      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_status_failed', error)
    }
  }

  async getPhoneData(
    instanceId: string,
    token: string,
  ): Promise<PhoneDataResponse | null> {
    try {
      const { data } = await this.http.get<PhoneDataResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/device`,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )

      return data
    } catch (error) {
      logThinkzapError(apiLogger, 'thinkzap.zapi.phone_data_failed', {
        app: 'thinkzap',
        instanceId,
        err: error,
      })
      return null
    }
  }

  async getQRCode(instanceId: string, instanceToken: string): Promise<string> {
    try {
      const { data } = await this.http.get<string>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/qr-code/image`,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.qrcode_failed', error)
    }
  }

  async sendMessage(
    instanceId: string,
    instanceToken: string,
    message: string,
    phone: string,
    options?: { referencedMessageId?: string },
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await this.http.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`,
        {
          message,
          phone,
          ...(options?.referencedMessageId
            ? { messageId: options.referencedMessageId }
            : {}),
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      logZApiSend('sendMessage', instanceId, phone, data)
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.message_send_failed', error)
    }
  }

  async sendImage(
    instanceId: string,
    instanceToken: string,
    image: string,
    phone: string,
    options?: { referencedMessageId?: string; caption?: string },
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await this.http.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-image`,
        {
          phone,
          image,
          ...(options?.caption ? { caption: options.caption } : {}),
          ...(options?.referencedMessageId
            ? { messageId: options.referencedMessageId }
            : {}),
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      logZApiSend('sendImage', instanceId, phone, data)
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.message_send_failed', error)
    }
  }

  async sendButtonActions(
    instanceId: string,
    instanceToken: string,
    params: SendButtonActionsParams,
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await this.http.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-button-actions`,
        params,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      logZApiSend('sendButtonActions', instanceId, params.phone, data)
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.message_send_failed', error)
    }
  }

  async sendVideo(
    instanceId: string,
    instanceToken: string,
    video: string,
    phone: string,
    options?: { referencedMessageId?: string; caption?: string },
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await this.http.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-video`,
        {
          phone,
          video,
          ...(options?.caption ? { caption: options.caption } : {}),
          ...(options?.referencedMessageId
            ? { messageId: options.referencedMessageId }
            : {}),
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      logZApiSend('sendVideo', instanceId, phone, data)
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.message_send_failed', error)
    }
  }

  async disconnectInstance(
    instanceId: string,
    instanceToken: string,
  ): Promise<void> {
    try {
      await this.http.get(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/disconnect`,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_disconnect_failed', error)
    }
  }

  async cancelInstance(
    instanceId: string,
    instanceToken: string,
  ): Promise<void> {
    try {
      await this.http.post(
        `https://api.z-api.io/integrator/on-demand/cancel`,
        {
          instanceId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.zApiToken}`,
            'Content-Type': 'application/json',
          },
        },
      )
      return
    } catch {
      // fallback para disconnect abaixo
    }

    await this.disconnectInstance(instanceId, instanceToken)
  }

  async sendAudio(
    instanceId: string,
    instanceToken: string,
    audio: string,
    phone: string,
    options?: { referencedMessageId?: string },
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await this.http.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-audio`,
        {
          phone,
          audio,
          waveform: true,
          ...(options?.referencedMessageId
            ? { messageId: options.referencedMessageId }
            : {}),
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      logZApiSend('sendAudio', instanceId, phone, data)
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.message_send_failed', error)
    }
  }

  private instanceHeaders() {
    return {
      'client-token': this.clientToken,
      'Content-Type': 'application/json',
    }
  }

  private instanceBaseUrl(instanceId: string, instanceToken: string) {
    return `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`
  }

  async createGroup(
    instanceId: string,
    instanceToken: string,
    params: CreateGroupParams,
  ): Promise<CreateGroupResponse> {
    try {
      const { data } = await this.http.post<CreateGroupResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/create-group`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async listGroups(
    instanceId: string,
    instanceToken: string,
    page = 1,
    pageSize = 20,
  ): Promise<ZApiGroupListItem[]> {
    try {
      const { data } = await this.http.get<ZApiGroupListItem[]>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/groups`,
        {
          params: { page, pageSize },
          headers: this.instanceHeaders(),
        },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async getGroupMetadata(
    instanceId: string,
    instanceToken: string,
    groupId: string,
  ): Promise<ZApiGroupMetadata> {
    try {
      const { data } = await this.http.get<ZApiGroupMetadata>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/group-metadata/${encodeURIComponent(groupId)}`,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async getProfilePicture(
    instanceId: string,
    instanceToken: string,
    phone: string,
  ): Promise<string | null> {
    try {
      const { data } = await this.http.get<ProfilePictureResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/profile-picture`,
        {
          params: { phone },
          headers: this.instanceHeaders(),
        },
      )
      if (Array.isArray(data) && data[0]?.link) return data[0].link
      if (data && typeof data === 'object' && 'link' in data) {
        return (data as { link: string }).link
      }
      return null
    } catch {
      return null
    }
  }

  // Só existe telefone→LID (nunca o inverso); sem isso conversas do CRM duplicariam. Erro → null, não lança.
  async phoneExists(
    instanceId: string,
    instanceToken: string,
    phone: string,
  ): Promise<{ exists: boolean; phone: string; lid: string | null } | null> {
    try {
      const { data } = await this.http.get<PhoneExistsResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/phone-exists`,
        {
          params: { phone },
          headers: this.instanceHeaders(),
        },
      )

      // Normalmente array; tolera objeto solto porque a forma não é contratual.
      const entry = Array.isArray(data) ? data[0] : data
      if (!entry || typeof entry !== 'object') return null

      return {
        exists: Boolean(entry.exists),
        phone: entry.phone ?? phone,
        lid: entry.lid ?? null,
      }
    } catch (err) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          provider: 'ZAPI',
          operation: 'phoneExists',
          instanceId,
          phone,
          err,
        },
        'Z-API não resolveu o lid do telefone',
      )
      return null
    }
  }

  async addGroupParticipants(
    instanceId: string,
    instanceToken: string,
    params: AddGroupParticipantsParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await this.http.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/add-participant`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async removeGroupParticipants(
    instanceId: string,
    instanceToken: string,
    params: RemoveGroupParticipantsParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await this.http.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/remove-participant`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async updateGroupName(
    instanceId: string,
    instanceToken: string,
    params: UpdateGroupNameParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await this.http.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/update-group-name`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async updateGroupDescription(
    instanceId: string,
    instanceToken: string,
    params: UpdateGroupDescriptionParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await this.http.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/update-group-description`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async updateGroupPhoto(
    instanceId: string,
    instanceToken: string,
    params: UpdateGroupPhotoParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await this.http.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/update-group-photo`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async leaveGroup(
    instanceId: string,
    instanceToken: string,
    params: LeaveGroupParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await this.http.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/leave-group`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.group_op_failed', error)
    }
  }

  async sendDocument(
    instanceId: string,
    instanceToken: string,
    document: string,
    phone: string,
    fileName?: string,
    options?: { referencedMessageId?: string; caption?: string },
  ): Promise<SendMessageResponse> {
    try {
      const extension =
        fileName && fileName.includes('.')
          ? fileName.split('.').pop()?.toLowerCase() || 'bin'
          : 'bin'
      const { data } = await this.http.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-document/${extension}`,
        {
          phone,
          document,
          fileName,
          ...(options?.caption ? { caption: options.caption } : {}),
          ...(options?.referencedMessageId
            ? { messageId: options.referencedMessageId }
            : {}),
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      logZApiSend('sendDocument', instanceId, phone, data)
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.message_send_failed', error)
    }
  }
}

export type SendMessageResponse = {
  zaapId: string
  messageId: string
  id: string
}
