import axios from 'axios'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import type { ClickSignSettings } from '../domain/repositories/clicksign-settings.repository'
import type { CommunicateBy } from '../domain/entities/signer'
import { ClicksignClient } from '../infra/clients/clicksign.client'
import {
  ClicksignApiError,
  safeErrorMessage,
} from '../infra/clients/clicksign-error'
import { logClicksignError } from '../errors/catalog'
import { normalizeBitrixDomain } from '@/shared/infra/clients/normalize-bitrix-domain'
import { apiLogger } from '@/shared/infra/logger'
import {
  ClicksignFields,
  ClicksignGroup,
  ContactSettings,
  EmpresaToken,
  VerifySettings,
  pickCode,
} from './clicksign-settings.types'
import { buildSigners, SignerSpec } from './build-signers'
import { buildRequirements, RequirementSigner } from './build-requirements'
import { buildActivityCard, CardSigner } from './build-activity-card'

export interface RobotProps {
  group: string
  empresa: string
  token: CommunicateBy
  sequencia: 'Y' | 'N'
  refusable: 'Y' | 'N'
}

export interface SendEnvelopeInput {
  settings: ClickSignSettings
  props: RobotProps
  entity: string
  entityId: string
  domain: string
  token: string
  bitrix: BitrixRestClient
}

export class SendEnvelopeUseCase {
  async execute(input: SendEnvelopeInput): Promise<void> {
    const { settings, props, entity, entityId, domain, token, bitrix } = input

    const groups = asArray<ClicksignGroup>(settings.groups)
    const group = groups.find(
      g => typeof g.id === 'string' && g.id.replaceAll(' ', '') === props.group,
    )
    if (!group) {
      logClicksignError(apiLogger, 'clicksign.envelope.group_not_found', {
        group: props.group,
      })
      return
    }

    const fields = settings.fields as ClicksignFields | null
    const company = (fields?.tokens ?? []).find(t => t.token === props.empresa)
    if (!company) {
      logClicksignError(
        apiLogger,
        'clicksign.envelope.company_token_not_found',
        {
          empresa: props.empresa,
        },
      )
      return
    }

    const clicksign = new ClicksignClient(company.ambiente)
    const empresaToken = company.token

    const deal = (await bitrix.callMethod(`crm.${entity}.get`, {
      id: entityId,
    })) as Record<string, unknown>
    const title = str(deal.TITLE)

    const signers = await buildSigners({
      group,
      deal,
      contactSettings: settings.contactSettings as ContactSettings | null,
      refusable: props.refusable === 'Y',
      communicateBy: props.token,
      bitrix,
    })

    // sequencia=Y: `group` pela ordem (sequencial v3); =N: mesmo grupo (paralelo).
    if (props.sequencia === 'Y') {
      signers.forEach((s, i) => {
        s.group = i + 1
      })
    }

    // Sem signer a ativação falha com 422 "existem documentos sem requisitos".
    if (signers.length === 0) {
      logClicksignError(apiLogger, 'clicksign.envelope.no_signers', {
        entity,
        entityId,
      })
      await this.comment(
        bitrix,
        entity,
        entityId,
        'Nenhum signatário encontrado para o grupo selecionado',
      )
      return
    }

    let envelopeKey: string
    let envelopeSelfUrl: string | undefined
    try {
      const envelope = await clicksign.createEnvelope(empresaToken, {
        name: title,
        remindInterval: company.lembrete,
        deadlineAt: deadline(deal, group),
      })
      envelopeKey = envelope.id
      envelopeSelfUrl = envelope.links?.self
    } catch (error) {
      logClicksignError(apiLogger, 'clicksign.envelope.create_failed', {
        entity,
        entityId,
        err: safeErrorMessage(error),
      })
      await this.comment(bitrix, entity, entityId, error)
      return
    }

    apiLogger.info(
      {
        app: 'clicksign',
        envelopeKey,
        entity,
        entityId,
        signers: signers.length,
      },
      'Envelope criado na Clicksign',
    )

    let file: { contentBase64: string; filename: string }
    try {
      file = await downloadFileBase64(deal, group, domain, token, title)
    } catch (error) {
      // axios = baixou e falhou; senão = não tinha arquivo anexado.
      const failedDownload = axios.isAxiosError(error)
      logClicksignError(
        apiLogger,
        failedDownload
          ? 'clicksign.envelope.file_download_failed'
          : 'clicksign.envelope.file_missing',
        { entity, entityId, err: safeErrorMessage(error) },
      )
      await this.comment(
        bitrix,
        entity,
        entityId,
        failedDownload
          ? 'Não foi possível baixar o arquivo anexado'
          : 'Documento não anexado ao negócio',
      )
      return
    }

    // Falha daqui em diante deixa o envelope órfão na Clicksign: comenta e para.
    let created: Array<{ signerKey: string; spec: SignerSpec }>
    let documentId: string
    let documentSelfUrl: string | undefined
    try {
      created = await this.createSigners(
        clicksign,
        empresaToken,
        envelopeKey,
        signers,
      )

      const document = await clicksign.addDocument(empresaToken, envelopeKey, {
        filename: file.filename,
        contentBase64: file.contentBase64,
      })
      documentId = document.id
      documentSelfUrl = document.links?.self

      const requirements = buildRequirements({
        documentId,
        signers: created.map<RequirementSigner>(s => ({
          signerId: s.signerKey,
          signAs: s.spec.signAs,
          communicateBy: s.spec.communicateBy,
        })),
        verifySettings: settings.verifySettings as VerifySettings,
      })
      for (const requirement of requirements) {
        await clicksign.addRequirement(empresaToken, envelopeKey, requirement)
      }

      await clicksign.activateEnvelope(empresaToken, envelopeKey)
    } catch (error) {
      logClicksignError(apiLogger, 'clicksign.envelope.activation_failed', {
        entity,
        entityId,
        envelopeKey,
        err: safeErrorMessage(error),
      })
      await this.comment(bitrix, entity, entityId, error)
      return
    }

    apiLogger.info(
      { app: 'clicksign', envelopeKey, documentId, signers: created.length },
      'Envelope ativado e documento enviado para assinatura',
    )

    // Antes do notify: o card de tracking/cancelamento deve existir mesmo se ele falhar.
    await this.writeBack({
      bitrix,
      entity,
      entityId,
      group,
      documentId,
      envelopeKey,
      apiToken: empresaToken,
      selfUrl: documentSelfUrl ?? envelopeSelfUrl,
      cardSigners: created.map<CardSigner>(s => ({
        signerKey: s.signerKey,
        name: s.spec.name,
        email: s.spec.email,
      })),
    })

    try {
      await clicksign.notify(empresaToken, envelopeKey)
    } catch (error) {
      // Documento já criado/ativado; aviso é o único que faltou → warn (não fatal).
      logClicksignError(apiLogger, 'clicksign.envelope.notify_failed', {
        envelopeKey,
        err: safeErrorMessage(error),
      })
    }
  }

  private async createSigners(
    clicksign: ClicksignClient,
    empresaToken: string,
    envelopeKey: string,
    signers: SignerSpec[],
  ): Promise<Array<{ signerKey: string; spec: SignerSpec }>> {
    const created: Array<{ signerKey: string; spec: SignerSpec }> = []
    for (const spec of signers) {
      const signer = await clicksign.addSigner(empresaToken, envelopeKey, {
        name: spec.name,
        email: spec.email,
        hasDocumentation: spec.hasDocumentation,
        refusable: spec.refusable,
        group: spec.group,
        communicateBy: spec.communicateBy,
        documentation: spec.documentation,
      })
      created.push({ signerKey: signer.id, spec })
    }
    return created
  }

  private async writeBack(input: {
    bitrix: BitrixRestClient
    entity: string
    entityId: string
    group: ClicksignGroup
    documentId: string
    envelopeKey: string
    apiToken: string
    selfUrl?: string
    cardSigners: CardSigner[]
  }): Promise<void> {
    const cardInput = {
      dealId: input.entityId,
      documentId: input.documentId,
      envelopeKey: input.envelopeKey,
      groupId: input.group.id,
      signers: input.cardSigners,
      selfUrl: input.selfUrl,
      apiToken: input.apiToken,
    }
    const created = (await input.bitrix.callMethod(
      'crm.activity.configurable.add',
      buildActivityCard(cardInput),
    )) as { activity?: { id?: string | number } } | undefined

    // Segundo update injeta o activityId no botão de cancelar (só existe após o add).
    const activityId = created?.activity?.id
    if (activityId != null) {
      await input.bitrix.callMethod(
        'crm.activity.configurable.update',
        buildActivityCard({ ...cardInput, activityId }),
      )
    }

    const clicksignIdCode = pickCode(input.group.clicksign_id)
    if (clicksignIdCode) {
      await input.bitrix.callMethod('crm.deal.update', {
        id: input.entityId,
        fields: { [clicksignIdCode]: input.documentId },
      })
    }
  }

  private async comment(
    bitrix: BitrixRestClient,
    entity: string,
    entityId: string,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof ClicksignApiError
        ? error.providerMessage
        : typeof error === 'string'
          ? error
          : 'Erro ao enviar documento'
    await bitrix.callMethod('crm.timeline.comment.add', {
      fields: {
        ENTITY_ID: entityId,
        ENTITY_TYPE: entity.toLowerCase(),
        COMMENT: `[Clicksign] ${message}`,
      },
    })
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function str(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

// `+`→`-` por paridade com o flow Prismatic.
function deadline(
  deal: Record<string, unknown>,
  group: ClicksignGroup,
): string | undefined {
  const code = pickCode(group.data_limite)
  const value = code ? deal[code] : undefined
  return typeof value === 'string' ? value.replace('+', '-') : undefined
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

async function downloadFileBase64(
  deal: Record<string, unknown>,
  group: ClicksignGroup,
  domain: string,
  token: string,
  fallbackName: string,
): Promise<{ contentBase64: string; filename: string }> {
  const code = pickCode(group.arquivo)
  const fieldRaw = code ? deal[code] : undefined
  const field = (Array.isArray(fieldRaw) ? fieldRaw[0] : fieldRaw) as
    | { downloadUrl?: string; name?: string }
    | undefined
  const downloadUrl = field?.downloadUrl
  if (!downloadUrl) throw new Error('Arquivo não anexado')

  const sep = downloadUrl.includes('?') ? '&' : '?'
  const url = `https://${normalizeBitrixDomain(domain)}${downloadUrl}${sep}auth=${token}`
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  })
  const base64 = Buffer.from(res.data).toString('base64')

  const rawName = field?.name?.trim()
  const ext = (rawName?.split('.').pop() ?? 'pdf').toLowerCase()
  const mime = MIME_BY_EXT[ext] ?? 'application/pdf'
  const filename = rawName || `${fallbackName}.pdf`

  return { contentBase64: `data:${mime};base64,${base64}`, filename }
}
