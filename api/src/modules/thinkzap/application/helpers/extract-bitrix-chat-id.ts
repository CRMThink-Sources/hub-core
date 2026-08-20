/**
 * Lê o `CHAT_ID` da sessão de canal aberto devolvida por
 * `imconnector.send.messages`. Ausente quando o Bitrix não abre sessão.
 */
export function extractBitrixChatId(result: unknown): string | null {
  try {
    const r = result as {
      result?: { DATA?: { RESULT?: Array<{ session?: { CHAT_ID?: string } }> } }
    }
    return r?.result?.DATA?.RESULT?.[0]?.session?.CHAT_ID ?? null
  } catch {
    return null
  }
}
