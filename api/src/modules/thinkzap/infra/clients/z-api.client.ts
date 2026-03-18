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
}

export type SendMessageResponse = {
  zaapId: string
  messageId: string
  id: string
}
