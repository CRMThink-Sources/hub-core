import axios from 'axios'
import { apiLogger } from '@/shared/infra/logger'
import { withDocumentLock } from '../infra/document-lock'
import { isProcessed, markProcessed } from '../infra/idempotency'
import type { ClickSignSettings } from '../domain/repositories/clicksign-settings.repository'
import { ClicksignGroup, pickCode } from './clicksign-settings.types'
import type { BitrixCaller } from './provisioning.service'

export interface WebhookEvent {
  name: 'sign' | 'document_closed' | 'refusal' | 'cancel' | 'deadline'
  occurred_at?: string
  data?: {
    signer?: { key?: string; name?: string; email?: string }
    refusal?: { reasons?: string[]; comment?: string }
  }
}

export interface WebhookPayload {
  event: WebhookEvent
  document: {
    key: string
    filename?: string
    downloads?: { signed_file_url?: string }
  }
}

interface ActivityRow {
  ID: string
  OWNER_ID: string
  ORIGIN_ID: string
  PROVIDER_DATA: string
}

export class HandleSignatureEventUseCase {
  constructor(
    private readonly bitrix: BitrixCaller,
    private readonly settings: ClickSignSettings,
  ) {}

  async handle(payload: WebhookPayload): Promise<void> {
    apiLogger.info(
      {
        app: 'clicksign',
        event: payload.event.name,
        documentKey: payload.document.key,
      },
      'Evento de assinatura recebido',
    )
    switch (payload.event.name) {
      case 'sign':
        return this.handleSign(payload)
      case 'refusal':
        return this.handleRefusal(payload)
      case 'cancel':
      case 'deadline':
        return this.handleCancelOrDeadline(payload)
      case 'document_closed':
        return this.handleDocumentClosed(payload)
    }
  }

  async handleSign(payload: WebhookPayload): Promise<void> {
    const signerKey = payload.event.data?.signer?.key
    if (!signerKey) return

    // Lock: signs concorrentes não podem sobrescrever o originId (last-write-wins).
    await withDocumentLock(payload.document.key, async () => {
      const row = await this.findActivity(payload.document.key)
      if (!row) return

      const originId = parseJson(row.ORIGIN_ID)
      const layout = parseJson(row.PROVIDER_DATA)
      if (!originId || !layout) return

      setBlockStatus(layout, signerKey, 'Assinado')
      originId[signerKey] = true

      await this.bitrix.callMethod('crm.activity.configurable.update', {
        id: row.ID,
        fields: { originId: JSON.stringify(originId) },
        layout,
      })

      const signer = payload.event.data?.signer
      apiLogger.info(
        {
          app: 'clicksign',
          documentKey: payload.document.key,
          dealId: row.OWNER_ID,
          signer: signer?.name ?? signer?.email ?? signerKey,
        },
        'Assinatura recebida',
      )

      if (allSigned(originId)) {
        const group = this.findGroup(originId.group)
        const code = pickCode(group?.contato_assinado)
        if (code) {
          await this.bitrix.callMethod('crm.deal.update', {
            id: row.OWNER_ID,
            fields: { [code]: 'Sim' },
          })
        }
        apiLogger.info(
          {
            app: 'clicksign',
            documentKey: payload.document.key,
            dealId: row.OWNER_ID,
          },
          'Documento totalmente assinado',
        )
      }
    })
  }

  async handleRefusal(payload: WebhookPayload): Promise<void> {
    const row = await this.findActivity(payload.document.key)
    if (!row) return
    const signerKey = payload.event.data?.signer?.key
    if (!signerKey) return

    const layout = parseJson(row.PROVIDER_DATA)
    if (!layout) return

    // Recusa é terminal (block_after_refusal): fecha a activity.
    setBlockStatus(layout, signerKey, 'Recusado')
    setHeaderStatus(layout, 'Recusado', 'failure')
    clearFooterButtons(layout)

    await this.bitrix.callMethod('crm.activity.configurable.update', {
      id: row.ID,
      fields: { completed: 'Y', status: '2' },
      layout,
    })

    const signer = payload.event.data?.signer
    const quem = signer?.name ?? signer?.email ?? 'Signatário'
    const refusal = payload.event.data?.refusal
    const hora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    })
    const linhas = [`Recusado por ${quem} em ${hora}`]
    if (refusal?.reasons?.length) {
      linhas.push(`Motivo(s): ${refusal.reasons.join(', ')}`)
    }
    if (refusal?.comment) linhas.push(`Descrição: ${refusal.comment}`)
    await this.bitrix.callMethod('crm.timeline.logmessage.add', {
      fields: {
        entityTypeId: 2,
        entityId: row.OWNER_ID,
        title: '[Clicksign] Documento recusado',
        text: linhas.join('\n'),
        iconCode: 'info',
      },
    })

    apiLogger.info(
      {
        app: 'clicksign',
        documentKey: payload.document.key,
        dealId: row.OWNER_ID,
      },
      'Documento recusado',
    )
  }

  async handleCancelOrDeadline(payload: WebhookPayload): Promise<void> {
    const row = await this.findActivity(payload.document.key)
    if (!row) return
    const layout = parseJson(row.PROVIDER_DATA)
    if (!layout) return

    const title = payload.event.name === 'cancel' ? 'Cancelado' : 'Expirado'
    setHeaderStatus(layout, title, 'failure')
    clearFooterButtons(layout)

    await this.bitrix.callMethod('crm.activity.configurable.update', {
      id: row.ID,
      fields: { completed: 'Y', status: '2' },
      layout,
    })

    apiLogger.info(
      {
        app: 'clicksign',
        event: payload.event.name,
        documentKey: payload.document.key,
        dealId: row.OWNER_ID,
      },
      `Documento ${title.toLowerCase()}`,
    )
  }

  async handleDocumentClosed(payload: WebhookPayload): Promise<void> {
    const documentKey = payload.document.key

    // Lock + idempotência: reentregas não podem reanexar o PDF nem reescrever
    // os campos do deal.
    await withDocumentLock(documentKey, async () => {
      if (await isProcessed('document_closed', documentKey)) return

      const row = await this.findActivity(documentKey)
      if (!row) return

      const layout = parseJson(row.PROVIDER_DATA)
      const originId = parseJson(row.ORIGIN_ID)
      const group = this.findGroup(originId?.group)
      if (layout) {
        setHeaderStatus(layout, 'Finalizado', 'success')
        clearFooterButtons(layout)
        await this.bitrix.callMethod('crm.activity.configurable.update', {
          id: row.ID,
          fields: { completed: 'Y', status: '2' },
          layout,
        })
      }

      const signedUrl = payload.document.downloads?.signed_file_url
      const dealFieldsRes = await this.bitrix.callMethod<{
        result?: Record<string, { type?: string }>
      }>('crm.deal.fields', {})
      const dealFields = dealFieldsRes.result

      const fields: Record<string, unknown> = {}
      const finalizadoCode = pickCode(group?.processo_finalizado)
      const dataCode = pickCode(group?.data_assinatura)
      const arquivoCode = pickCode(group?.arquivo_assinado)
      const contatoCode = pickCode(group?.contato_assinado)

      if (finalizadoCode && dealFields?.[finalizadoCode]?.type === 'string') {
        fields[finalizadoCode] = 'Sim'
      }
      if (dataCode && dealFields?.[dataCode] && payload.event.occurred_at) {
        fields[dataCode] = payload.event.occurred_at
      }
      if (
        arquivoCode &&
        dealFields?.[arquivoCode]?.type === 'file' &&
        signedUrl
      ) {
        const base64 = await downloadBase64(signedUrl)
        fields[arquivoCode] = {
          fileData: [payload.document.filename ?? 'documento.pdf', base64],
        }
      }
      if (contatoCode) fields[contatoCode] = 'Sim'

      if (Object.keys(fields).length > 0) {
        await this.bitrix.callMethod('crm.deal.update', {
          id: row.OWNER_ID,
          fields,
        })
      }

      await markProcessed('document_closed', documentKey)

      apiLogger.info(
        {
          app: 'clicksign',
          documentKey,
          dealId: row.OWNER_ID,
          camposAtualizados: Object.keys(fields).length,
        },
        'Documento finalizado processado',
      )
    })
  }

  private async findActivity(documentKey: string): Promise<ActivityRow | null> {
    const res = await this.bitrix.callMethod<{ result?: ActivityRow[] }>(
      'crm.activity.list',
      {
        order: { ID: 'DESC' },
        // `%SUBJECT` (LIKE): document keys são UUID, sem risco de colisão por prefixo.
        filter: { '%SUBJECT': documentKey },
        select: ['ID', 'OWNER_ID', 'ORIGIN_ID', 'PROVIDER_DATA', 'SUBJECT'],
      },
    )
    return res.result?.[0] ?? null
  }

  private findGroup(groupId: unknown): ClicksignGroup | undefined {
    const groups = Array.isArray(this.settings.groups)
      ? (this.settings.groups as ClicksignGroup[])
      : []
    return groups.find(g => g.id === groupId)
  }
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function setBlockStatus(
  layout: Record<string, unknown>,
  signerKey: string,
  status: string,
): void {
  const body = layout.body as
    | { blocks?: Record<string, { properties?: { value?: string } }> }
    | undefined
  const block = body?.blocks?.[signerKey]
  if (!block?.properties) return
  // Bloco é `nome - email - status`. Substitui só o último segmento para não
  // quebrar quando nome/email contêm "-".
  const current = String(block.properties.value ?? '')
  const idx = current.lastIndexOf(' - ')
  const prefix = idx >= 0 ? current.slice(0, idx) : current.trim()
  block.properties.value = `${prefix} - ${status}`
}

function clearFooterButtons(layout: Record<string, unknown>): void {
  const footer = layout.footer as { buttons?: unknown } | undefined
  if (footer) footer.buttons = {}
}

function setHeaderStatus(
  layout: Record<string, unknown>,
  title: string,
  type: 'success' | 'failure',
): void {
  const header = layout.header as { tags?: { status?: unknown } } | undefined
  if (!header?.tags) return
  header.tags.status = { title, type }
}

// Ignora `group`/`envelopeKey` — não são flags de signer.
function allSigned(originId: Record<string, unknown>): boolean {
  return Object.entries(originId)
    .filter(([key]) => key !== 'group' && key !== 'envelopeKey')
    .every(([, value]) => value !== false)
}

const SIGNED_FILE_MAX_BYTES = 25 * 1024 * 1024

async function downloadBase64(url: string): Promise<string> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    maxContentLength: SIGNED_FILE_MAX_BYTES,
    maxBodyLength: SIGNED_FILE_MAX_BYTES,
  })
  return Buffer.from(res.data).toString('base64')
}
