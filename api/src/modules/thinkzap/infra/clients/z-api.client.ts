import axios from 'axios'
import {
  CreateZApiInstanceParams,
  CreateZApiInstanceResponse,
  InstanceDataResponse,
  InstanceStatusResponse,
  ListZApiInstancesResponse,
  PhoneDataResponse,
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
