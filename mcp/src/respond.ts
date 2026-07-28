import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Toda tool responde texto simples pro suporte. */
export function text(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }] }
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
