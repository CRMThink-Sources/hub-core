import axios, { AxiosInstance } from 'axios'
import { CLICKSIGN_HOSTS, CLICKSIGN_VND_JSON } from '../../clicksign.constants'
import type {
  AddDocumentInput,
  ClicksignEnv,
  ClicksignResource,
  CreateEnvelopeInput,
  EnvelopeStatus,
} from '../../domain/entities/envelope'
import type { AddSignerInput } from '../../domain/entities/signer'
import type { AddRequirementInput } from '../../domain/entities/requirement'
import { parseClicksignError } from './clicksign-error'

interface JsonApiResponse {
  data?: {
    id?: string
    attributes?: { status?: string }
    links?: { self?: string }
  }
}

// Um client por ambiente; o access_token vai por chamada (query param) pois um
// app pode ter N contas.
export class ClicksignClient {
  private readonly http: AxiosInstance

  constructor(environment: ClicksignEnv) {
    this.http = axios.create({
      baseURL: `${CLICKSIGN_HOSTS[environment]}/api/v3`,
      headers: { 'Content-Type': CLICKSIGN_VND_JSON },
      timeout: 30000,
    })
  }

  createEnvelope(
    token: string,
    input: CreateEnvelopeInput,
  ): Promise<ClicksignResource> {
    return this.post('/envelopes', token, {
      data: {
        type: 'envelopes',
        attributes: {
          name: input.name,
          remind_interval: input.remindInterval,
          deadline_at: input.deadlineAt,
        },
      },
    })
  }

  addSigner(
    token: string,
    envelopeId: string,
    input: AddSignerInput,
  ): Promise<ClicksignResource> {
    const attributes: Record<string, unknown> = {
      name: input.name,
      email: input.email,
      has_documentation: input.hasDocumentation,
      refusable: input.refusable,
      group: input.group,
      communicate_events: {
        document_signed: input.communicateBy,
        signature_request: input.communicateBy,
        signature_reminder: input.communicateBy,
      },
    }
    // documentation só quando há CPF (paridade Prismatic).
    if (input.hasDocumentation && input.documentation) {
      attributes.documentation = input.documentation
    }
    return this.post(`/envelopes/${envelopeId}/signers`, token, {
      data: { type: 'signers', attributes },
    })
  }

  addDocument(
    token: string,
    envelopeId: string,
    input: AddDocumentInput,
  ): Promise<ClicksignResource> {
    return this.post(`/envelopes/${envelopeId}/documents`, token, {
      data: {
        type: 'documents',
        attributes: {
          filename: input.filename,
          content_base64: input.contentBase64,
        },
      },
    })
  }

  async addRequirement(
    token: string,
    envelopeId: string,
    input: AddRequirementInput,
  ): Promise<void> {
    const attributes: Record<string, unknown> = { action: input.action }
    if (input.role) attributes.role = input.role
    if (input.pages) attributes.pages = input.pages
    if (input.auth) attributes.auth = input.auth

    await this.post(`/envelopes/${envelopeId}/requirements`, token, {
      data: {
        type: 'requirements',
        attributes,
        relationships: {
          document: { data: { type: 'documents', id: input.documentId } },
          signer: { data: { type: 'signers', id: input.signerId } },
        },
      },
    })
  }

  activateEnvelope(
    token: string,
    envelopeId: string,
  ): Promise<ClicksignResource> {
    return this.patchStatus(token, envelopeId, 'running')
  }

  // Na v3 o cancelamento é no documento, não no envelope (PATCH de envelope só
  // aceita draft/running). Documento precisa estar `running`.
  cancelDocument(
    token: string,
    envelopeId: string,
    documentId: string,
  ): Promise<ClicksignResource> {
    return this.patch(
      `/envelopes/${envelopeId}/documents/${documentId}`,
      token,
      {
        data: {
          id: documentId,
          type: 'documents',
          attributes: { status: 'canceled' },
        },
      },
    )
  }

  async notify(token: string, envelopeId: string): Promise<void> {
    await this.post(`/envelopes/${envelopeId}/notifications`, token, {
      data: { type: 'notifications', attributes: {} },
    })
  }

  // Retorna o secret HMAC em `data.attributes.secret`. `status: active` é
  // obrigatório: o default da Clicksign é `inactive`.
  async registerWebhook(
    token: string,
    input: { url: string; events: readonly string[] },
  ): Promise<{ id: string; secret?: string }> {
    try {
      const res = await this.http.post<{
        data?: { id?: string; attributes?: { secret?: string } }
      }>(
        '/webhooks',
        {
          data: {
            type: 'webhooks',
            attributes: {
              endpoint: input.url,
              status: 'active',
              events: input.events,
            },
          },
        },
        { params: { access_token: token } },
      )
      return {
        id: res.data?.data?.id ?? '',
        secret: res.data?.data?.attributes?.secret,
      }
    } catch (error) {
      throw parseClicksignError(error)
    }
  }

  async listWebhooks(
    token: string,
  ): Promise<Array<{ id: string; endpoint?: string }>> {
    try {
      const res = await this.http.get<{
        data?: Array<{ id?: string; attributes?: { endpoint?: string } }>
      }>('/webhooks', { params: { access_token: token } })
      return (res.data?.data ?? []).map(w => ({
        id: w.id ?? '',
        endpoint: w.attributes?.endpoint,
      }))
    } catch (error) {
      throw parseClicksignError(error)
    }
  }

  async deleteWebhook(token: string, id: string): Promise<void> {
    try {
      await this.http.delete(`/webhooks/${id}`, {
        params: { access_token: token },
      })
    } catch (error) {
      throw parseClicksignError(error)
    }
  }

  private patchStatus(
    token: string,
    envelopeId: string,
    status: EnvelopeStatus,
  ): Promise<ClicksignResource> {
    return this.patch(`/envelopes/${envelopeId}`, token, {
      data: { id: envelopeId, type: 'envelopes', attributes: { status } },
    })
  }

  private async post(
    path: string,
    token: string,
    body: unknown,
  ): Promise<ClicksignResource> {
    try {
      const res = await this.http.post<JsonApiResponse>(path, body, {
        params: { access_token: token },
      })
      return toResource(res.data)
    } catch (error) {
      throw parseClicksignError(error)
    }
  }

  private async patch(
    path: string,
    token: string,
    body: unknown,
  ): Promise<ClicksignResource> {
    try {
      const res = await this.http.patch<JsonApiResponse>(path, body, {
        params: { access_token: token },
      })
      return toResource(res.data)
    } catch (error) {
      throw parseClicksignError(error)
    }
  }
}

function toResource(payload: JsonApiResponse): ClicksignResource {
  const data = payload?.data
  return {
    id: data?.id ?? '',
    status: data?.attributes?.status,
    links: data?.links,
  }
}
