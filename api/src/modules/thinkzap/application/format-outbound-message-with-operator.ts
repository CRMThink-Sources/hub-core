export function formatOutboundMessageWithOperator(
  text: string,
  options: { enabled: boolean; operatorName: string | null },
): string {
  if (!options.enabled) {
    return text
  }

  const operatorName = options.operatorName?.trim()
  if (!operatorName) {
    return text
  }

  return `*${operatorName}:* ${text}`
}
