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

export class ZApiClient {
  private readonly zApiToken: string
  private readonly clientToken: string | null = null

  constructor(zApiToken: string, clientToken: string | null = null) {
    this.zApiToken = zApiToken
    this.clientToken = clientToken
  }

  async createInstance(
    params: CreateZApiInstanceParams,
  ): Promise<CreateZApiInstanceResponse> {
    try {
      const { data } = await axios.post<CreateZApiInstanceResponse>(
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
      throw new Error('Failed to create instance')
    }
  }

  async subscribe(id: string, token: string): Promise<void> {
    try {
      const { data } = await axios.post<void>(
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
      throw new Error('Failed to subscribe')
    }
  }

  async unsubscribe(id: string, token: string): Promise<void> {
    try {
      const { data } = await axios.post<void>(
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
      throw new Error('Failed to unsubscribe')
    }
  }

  async updateInstance(
    instanceId: string,
    name: string,
    token: string,
  ): Promise<void> {
    try {
      const { data } = await axios.put<void>(
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
      console.log(error)
      throw new Error('Failed to update instance')
    }
  }

  async listInstances(): Promise<ListZApiInstancesResponse> {
    try {
      const { data } = await axios.get<ListZApiInstancesResponse>(
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
      throw new Error('Failed to list instances')
    }
  }

  async getInstance(
    instanceId: string,
    token: string,
  ): Promise<InstanceDataResponse> {
    try {
      const { data } = await axios.get<InstanceDataResponse>(
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
      console.log(error)
      throw new Error('Failed to get instance data')
    }
  }

  async getInstanceStatus(
    instanceId: string,
    token: string,
  ): Promise<InstanceStatusResponse> {
    try {
      const { data } = await axios.get<InstanceStatusResponse>(
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
      throw new Error('Failed to get instance status')
    }
  }

  async getPhoneData(
    instanceId: string,
    token: string,
  ): Promise<PhoneDataResponse | null> {
    try {
      const { data } = await axios.get<PhoneDataResponse>(
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
      console.log(error)
      return null
    }
  }

  async getQRCode(instanceId: string, instanceToken: string): Promise<string> {
    try {
      const { data } = await axios.get<string>(
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
      throw new Error('Failed to get QR code')
    }
  }

  async sendMessage(
    instanceId: string,
    instanceToken: string,
    message: string,
    phone: string,
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await axios.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`,
        {
          message,
          phone,
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to send message')
    }
  }

  async sendImage(
    instanceId: string,
    instanceToken: string,
    image: string,
    phone: string,
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await axios.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-image`,
        {
          phone,
          image,
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to send image')
    }
  }

  async sendVideo(
    instanceId: string,
    instanceToken: string,
    video: string,
    phone: string,
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await axios.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-video`,
        {
          phone,
          video,
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to send video')
    }
  }

  async disconnectInstance(
    instanceId: string,
    instanceToken: string,
  ): Promise<void> {
    try {
      await axios.get(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/disconnect`,
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
    } catch (error) {
      console.log(error)
      throw new Error('Failed to disconnect instance')
    }
  }

  async cancelInstance(
    instanceId: string,
    instanceToken: string,
  ): Promise<void> {
    try {
      const response = await axios.post(
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
      console.log({ data: response, instanceId })
      return
    } catch (error) {
      console.log(
        '[z-api] cancel endpoint failed, fallback to disconnect',
        instanceId,
      )
    }

    await this.disconnectInstance(instanceId, instanceToken)
  }

  async sendAudio(
    instanceId: string,
    instanceToken: string,
    audio: string,
    phone: string,
  ): Promise<SendMessageResponse> {
    try {
      const { data } = await axios.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-audio`,
        {
          phone,
          audio,
          waveform: true,
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to send video')
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
      const { data } = await axios.post<CreateGroupResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/create-group`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to create group')
    }
  }

  async listGroups(
    instanceId: string,
    instanceToken: string,
    page = 1,
    pageSize = 20,
  ): Promise<ZApiGroupListItem[]> {
    try {
      const { data } = await axios.get<ZApiGroupListItem[]>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/groups`,
        {
          params: { page, pageSize },
          headers: this.instanceHeaders(),
        },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to list groups')
    }
  }

  async getGroupMetadata(
    instanceId: string,
    instanceToken: string,
    groupId: string,
  ): Promise<ZApiGroupMetadata> {
    try {
      const { data } = await axios.get<ZApiGroupMetadata>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/group-metadata/${encodeURIComponent(groupId)}`,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to get group metadata')
    }
  }

  async getProfilePicture(
    instanceId: string,
    instanceToken: string,
    phone: string,
  ): Promise<string | null> {
    try {
      const { data } = await axios.get<ProfilePictureResponse>(
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
      const { data } = await axios.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/add-participant`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to add group participants')
    }
  }

  async removeGroupParticipants(
    instanceId: string,
    instanceToken: string,
    params: RemoveGroupParticipantsParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await axios.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/remove-participant`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to remove group participants')
    }
  }

  async updateGroupName(
    instanceId: string,
    instanceToken: string,
    params: UpdateGroupNameParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await axios.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/update-group-name`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to update group name')
    }
  }

  async updateGroupDescription(
    instanceId: string,
    instanceToken: string,
    params: UpdateGroupDescriptionParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await axios.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/update-group-description`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to update group description')
    }
  }

  async updateGroupPhoto(
    instanceId: string,
    instanceToken: string,
    params: UpdateGroupPhotoParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await axios.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/update-group-photo`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to update group photo')
    }
  }

  async leaveGroup(
    instanceId: string,
    instanceToken: string,
    params: LeaveGroupParams,
  ): Promise<ZApiBooleanResponse> {
    try {
      const { data } = await axios.post<ZApiBooleanResponse>(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/leave-group`,
        params,
        { headers: this.instanceHeaders() },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to leave group')
    }
  }

  async editMessage(
    instanceId: string,
    instanceToken: string,
    phone: string,
    messageId: string,
    newText: string,
  ): Promise<void> {
    try {
      await axios.post(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/send-message-edit`,
        { messageId, phone, message: newText },
        { headers: this.instanceHeaders() },
      )
    } catch (error) {
      console.log(error)
      throw new Error('Failed to edit message')
    }
  }

  async deleteMessage(
    instanceId: string,
    instanceToken: string,
    phone: string,
    messageId: string,
  ): Promise<void> {
    try {
      await axios.delete(
        `${this.instanceBaseUrl(instanceId, instanceToken)}/messages/${encodeURIComponent(phone)}/${encodeURIComponent(messageId)}`,
        { headers: this.instanceHeaders() },
      )
    } catch (error) {
      console.log(error)
      throw new Error('Failed to delete message')
    }
  }

  async sendDocument(
    instanceId: string,
    instanceToken: string,
    document: string,
    phone: string,
    fileName?: string,
  ): Promise<SendMessageResponse> {
    try {
      const extension =
        fileName && fileName.includes('.')
          ? fileName.split('.').pop()?.toLowerCase() || 'bin'
          : 'bin'
      const { data } = await axios.post<SendMessageResponse>(
        `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-document/${extension}`,
        {
          phone,
          document,
          fileName,
        },
        {
          headers: {
            'client-token': this.clientToken,
            'Content-Type': 'application/json',
          },
        },
      )
      return data
    } catch (error) {
      console.log(error)
      throw new Error('Failed to send document')
    }
  }
}

export type SendMessageResponse = {
  zaapId: string
  messageId: string
  id: string
}
