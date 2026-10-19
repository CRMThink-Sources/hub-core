import type { OutboundMessageKind } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'

export type RobotFileKind = Exclude<OutboundMessageKind, 'text'>

export type RobotFileClassification = {
  kind: RobotFileKind
  /** Mime usado no data URL. Do Bitrix quando veio; senão, pela extensão. */
  mime: string
}

/**
 * Extensões que o WhatsApp entrega como mídia própria. Fora desta tabela o
 * arquivo vai como documento — nunca é descartado por formato.
 */
const MEDIA_BY_EXTENSION: Record<string, RobotFileClassification> = {
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  webp: { kind: 'image', mime: 'image/webp' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  '3gp': { kind: 'video', mime: 'video/3gpp' },
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  ogg: { kind: 'audio', mime: 'audio/ogg' },
  oga: { kind: 'audio', mime: 'audio/ogg' },
  opus: { kind: 'audio', mime: 'audio/opus' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  m4a: { kind: 'audio', mime: 'audio/mp4' },
  aac: { kind: 'audio', mime: 'audio/aac' },
}

const MEDIA_BY_MIME: Record<string, RobotFileKind> = Object.fromEntries(
  Object.values(MEDIA_BY_EXTENSION).map(({ kind, mime }) => [mime, kind]),
)

const DOCUMENT_MIME = 'application/octet-stream'

/**
 * Tipo de envio de um arquivo do robô. O mime do Bitrix manda; sem ele (ou com
 * o genérico `application/octet-stream`), decide a extensão do nome.
 */
export function classifyRobotFile(file: {
  name?: string
  mime?: string
}): RobotFileClassification {
  const mime = file.mime?.split(';')[0]?.trim().toLowerCase()

  if (mime && mime !== DOCUMENT_MIME) {
    const kind = MEDIA_BY_MIME[mime]
    return { kind: kind ?? 'document', mime }
  }

  const extension = extensionOf(file.name)
  const media = extension ? MEDIA_BY_EXTENSION[extension] : undefined
  return media ?? { kind: 'document', mime: mime ?? DOCUMENT_MIME }
}

function extensionOf(name?: string): string | undefined {
  if (!name || !name.includes('.')) return undefined
  return name.split('.').pop()?.toLowerCase()
}
