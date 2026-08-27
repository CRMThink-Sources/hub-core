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
  ProfilePictureResponse,
  ZApiGroupListItem,
  ZApiGroupMetadata,
  ZApiListResponse,
} from './types/z-api.types'
import { UpdateInstanceGateway } from '../../domain/repositories/update-instance.gateway'
import { thinkzapError } from '../../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { attachProviderHttpLogging } from '@/shared/infra/clients/provider-http-logging'

/**
 * Registra o que a Z-API respondeu a um envio.
 *
 * Existe por causa do caso "o widget disse que enviou e não chegou no telefone": sem
 * este log não há prova de nada. Não se sabe se a Z-API aceitou, com qual id, nem para
 * qual número — e sem o id não há como consultar a mensagem no painel dela.
 *
 * O aceite da Z-API significa apenas **"recebi a ordem de enviar"**. A entrega ao
 * aparelho é assíncrona e chega depois pelo webhook `MessageStatusCallback`. Uma
 * mensagem com `zaapId` e `messageId` que nunca chegou é problema do outro lado, e
 * `messageId` é o que permite provar isso para o suporte da Z-API.
 *
 * **Nunca loga o token** — só o `instanceId`, que não é credencial.
 */
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
      /**
       * Resposta `200` sem `messageId` é estado que a tipagem não admite mas a rede
       * produz. Sem esta marca, o `undefined` viraria `providerMessageId` nulo lá na
       * frente e ninguém saberia que veio daqui.
       */
      missingMessageId: !response.messageId,
    },
    'Z-API aceitou o envio',
  )
}

export class ZApiClient {
  private readonly zApiToken: string
  private readonly clientToken: string | null = null

  /**
   * Instância própria em vez do `axios` global, só para carregar os interceptors de
   * log.
   *
   * O global é compartilhado com todo o processo: registrar interceptor nele instrumen-
   * taria também as chamadas ao Bitrix, à Stripe e ao Google — e o mascaramento de
   * token aqui é específico do formato de URL da Z-API.
   *
   * Sem `baseURL`: os métodos montam a URL absoluta, e mudar isso agora seria refactor
   * sem ganho. O interceptor funciona igual.
   */
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

  async subscribe(id: string, token: string): Promise<void> {
    try {
      const { data } = await this.http.post<void>(
        `https://api.z-api.io/instances/${id}/token/${token}/integrator/on-demand/subscription`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.zApiToken}`,
          },
        },
      )
      return data
    } catch (error) {
      throw thinkzapError('thinkzap.zapi.instance_subscribe_failed', error)
    }
  }

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
      throw thinkzapError('thinkzap.zapi.instance_subscribe_failed', error)
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
    } catch {
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
      // endpoint de cancel falhou → fallback pra disconnect abaixo
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
