export const WIDGET_ATTACHMENT_MAX_BYTES = 30 * 1024 * 1024

export const WIDGET_ATTACHMENT_MAX_MB =
  WIDGET_ATTACHMENT_MAX_BYTES / (1024 * 1024)

export function isAttachmentWithinSizeLimit(size: number): boolean {
  return size > 0 && size <= WIDGET_ATTACHMENT_MAX_BYTES
}

export function attachmentSizeErrorMessage(fileName: string): string {
  return `"${fileName}" excede o limite de ${WIDGET_ATTACHMENT_MAX_MB} MB por arquivo.`
}
