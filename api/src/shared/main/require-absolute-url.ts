/**
 * Valida uma URL absoluta vinda de configuração, e devolve a base sem barra final.
 *
 * Existe porque gateway de pagamento exige URL absoluta em `success_url`,
 * `cancel_url` e `return_url`. Com a variável ausente, a interpolação produz caminho
 * relativo (`/thinkzap/conexoes?...`) e o erro aparece **no gateway**, com mensagem
 * que não diz o que falta, depois de já ter ido à rede.
 *
 * A barra final é removida: `http://host/` interpolado com `/rota` produziria
 * `http://host//rota`, que o navegador resolve como outro host.
 */
export function requireAbsoluteUrl(value: string, varName: string): string {
  const raw = value.trim().replace(/\/+$/, '')

  if (!raw) {
    throw new Error(
      `${varName} não configurada: é preciso uma URL absoluta para o retorno do ` +
        'gateway de pagamento (success_url/cancel_url/return_url).',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(
      `${varName} inválida ("${raw}"): informe uma URL absoluta, com esquema — ` +
        'por exemplo http://localhost:3000.',
    )
  }

  /**
   * Só http e https. `new URL` aceita qualquer esquema — `file:`, `javascript:` —
   * e passar um desses ao gateway seria configuração errada chegando ao cliente
   * como link.
   */
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `${varName} inválida ("${raw}"): o esquema tem que ser http ou https.`,
    )
  }

  return raw
}
