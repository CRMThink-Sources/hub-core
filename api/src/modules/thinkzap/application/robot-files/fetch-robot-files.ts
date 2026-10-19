import axios from 'axios'
import type { ICrmItemResponse } from '@/shared/infra/clients/bitrix.client'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { classifyRobotFile, type RobotFileKind } from './classify-robot-file'

/** Teto por arquivo — o mesmo `limit` do body parser da API. */
export const ROBOT_FILE_MAX_BYTES = 30 * 1024 * 1024

export type RobotFileFailure = 'unavailable' | 'too_large'

export type RobotFileResult =
  | {
      status: 'ok'
      id: string
      name: string
      mime: string
      kind: RobotFileKind
      dataUrl: string
    }
  | { status: 'failed'; id: string; name: string; reason: RobotFileFailure }

export type DownloadedRobotFile = {
  data: Buffer
  contentType?: string
  contentDisposition?: string
}

export type RobotFileDeps = {
  getCrmItem: (entityTypeId: number, id: string) => Promise<ICrmItemResponse>
  /** Rejeita com `RobotFileTooLargeError` quando o arquivo passa de `maxBytes`. */
  download: (url: string, maxBytes: number) => Promise<DownloadedRobotFile>
}

export class RobotFileTooLargeError extends Error {
  constructor() {
    super('Robot file exceeds the size limit')
  }
}

/**
 * Baixa os arquivos do robô "Enviar mensagem".
 *
 * O robô entrega só os ids (`parseRobotFiles`). Cada id é procurado nos campos de
 * arquivo do documento do disparo: `crm.item.get` devolve esses campos como
 * `{ id, urlMachine }`, e o `urlMachine` já leva o token do app. O robô não diz de
 * qual campo veio o arquivo, então todos os campos com esse formato entram.
 *
 * Id que não está no item — arquivo enviado na configuração do robô, ou fluxo que
 * não roda sobre um documento do CRM — sai como `unavailable`. Um item só é lido
 * uma vez, e cada arquivo é baixado uma vez, qualquer que seja o número de
 * destinatários.
 */
export async function fetchRobotFiles(
  deps: RobotFileDeps,
  document: { entity: string; entityId: string } | null,
  ids: string[],
): Promise<RobotFileResult[]> {
  if (ids.length === 0) return []

  const links = await readFileLinks(deps, document, ids)
  // Sem documento ou sem leitura do item: o motivo já foi registrado uma vez.
  if (!links) return ids.map(id => failed(id, 'unavailable'))

  const results: RobotFileResult[] = []

  for (const id of ids) {
    const url = links.get(id)
    if (!url) {
      logUnavailable(id, 'not_in_document')
      results.push(failed(id, 'unavailable'))
      continue
    }

    results.push(await downloadOne(deps, id, url))
  }

  return results
}

/** Entidade do `document_id` do bizproc → `entityTypeId` do `crm.item.get`. */
export function crmEntityTypeIdOf(entity: string): number | null {
  switch (entity.toUpperCase()) {
    case 'LEAD':
      return 1
    case 'DEAL':
      return 2
    case 'CONTACT':
      return 3
    case 'COMPANY':
      return 4
  }

  const dynamic = /^DYNAMIC_(\d+)$/i.exec(entity)
  return dynamic ? Number(dynamic[1]) : null
}

/**
 * Nome do arquivo no `content-disposition`: `filename*` (UTF-8, o nome real com
 * espaços e acentos) e, na falta dele, `filename`.
 */
export function fileNameFromDisposition(
  disposition: string | undefined,
): string | undefined {
  if (!disposition) return undefined

  const extended = /filename\*\s*=\s*(?:utf-8|UTF-8)''([^;]+)/.exec(disposition)
  if (extended?.[1]) {
    try {
      return basename(decodeURIComponent(extended[1].trim()))
    } catch {
      // `filename*` mal codificado: cai no `filename` simples.
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(disposition)
  return plain?.[1] ? basename(plain[1].trim()) : undefined
}

/** Download real: o `urlMachine` já é autenticado, então é um GET simples. */
export async function downloadRobotFile(
  url: string,
  maxBytes: number,
): Promise<DownloadedRobotFile> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      maxContentLength: maxBytes,
      timeout: 60_000,
    })
    return {
      data: Buffer.from(response.data),
      contentType: header(response.headers['content-type']),
      contentDisposition: header(response.headers['content-disposition']),
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('maxContentLength')) {
      throw new RobotFileTooLargeError()
    }
    throw error
  }
}

/** `null` quando não há item para ler — sem documento do CRM, ou leitura falhou. */
async function readFileLinks(
  deps: RobotFileDeps,
  document: { entity: string; entityId: string } | null,
  ids: string[],
): Promise<Map<string, string> | null> {
  const links = new Map<string, string>()
  const entityTypeId = document ? crmEntityTypeIdOf(document.entity) : null
  if (!document || entityTypeId === null) {
    logThinkzapError(apiLogger, 'thinkzap.bitrix.robot_file_unavailable', {
      app: 'thinkzap',
      source: 'bitrix',
      reason: 'no_crm_document',
      entity: document?.entity,
      fileIds: ids,
    })
    return null
  }

  try {
    const response = await deps.getCrmItem(entityTypeId, document.entityId)
    for (const value of Object.values(response.result?.item ?? {})) {
      for (const candidate of Array.isArray(value) ? value : [value]) {
        const file = asFileValue(candidate)
        if (file) links.set(file.id, file.urlMachine)
      }
    }
  } catch (error) {
    logThinkzapError(apiLogger, 'thinkzap.bitrix.robot_file_unavailable', {
      app: 'thinkzap',
      source: 'bitrix',
      reason: 'crm_item_read_failed',
      entity: document.entity,
      entityId: document.entityId,
      fileIds: ids,
      err: (error as Error).message,
    })
    return null
  }

  return links
}

async function downloadOne(
  deps: RobotFileDeps,
  id: string,
  url: string,
): Promise<RobotFileResult> {
  try {
    const file = await deps.download(url, ROBOT_FILE_MAX_BYTES)
    const name = fileNameFromDisposition(file.contentDisposition) ?? `#${id}`

    if (file.data.length > ROBOT_FILE_MAX_BYTES) {
      return failed(id, 'too_large', name)
    }

    const { kind, mime } = classifyRobotFile({ name, mime: file.contentType })
    return {
      status: 'ok',
      id,
      name,
      mime,
      kind,
      dataUrl: `data:${mime};base64,${file.data.toString('base64')}`,
    }
  } catch (error) {
    if (error instanceof RobotFileTooLargeError) {
      return failed(id, 'too_large')
    }
    // Só o id e a mensagem: o `urlMachine` leva o token do portal.
    logUnavailable(id, 'download_failed', (error as Error).message)
    return failed(id, 'unavailable')
  }
}

function asFileValue(
  value: unknown,
): { id: string; urlMachine: string } | null {
  if (typeof value !== 'object' || value === null) return null
  const { id, urlMachine } = value as { id?: unknown; urlMachine?: unknown }
  if ((typeof id !== 'number' && typeof id !== 'string') || !urlMachine) {
    return null
  }
  return typeof urlMachine === 'string' ? { id: String(id), urlMachine } : null
}

function failed(
  id: string,
  reason: RobotFileFailure,
  name = `#${id}`,
): RobotFileResult {
  return { status: 'failed', id, name, reason }
}

function logUnavailable(fileId: string, reason: string, err?: string): void {
  logThinkzapError(apiLogger, 'thinkzap.bitrix.robot_file_unavailable', {
    app: 'thinkzap',
    source: 'bitrix',
    fileId,
    reason,
    ...(err ? { err } : {}),
  })
}

function basename(name: string): string {
  return name.split(/[\\/]/).pop() ?? name
}

function header(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
