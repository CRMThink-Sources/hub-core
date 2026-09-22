/**
 * Link `wa.me` para abrir conversa com um número, com mensagem pré-preenchida.
 *
 * O número vem de env e pode chegar formatado (`+55 (11) 99999-0000`); o `wa.me`
 * só aceita dígitos com DDI. Sem nenhum dígito devolve `null` — quem chama esconde
 * o botão em vez de mostrar um link que abre o WhatsApp sem destino.
 */
export function buildWhatsappLink(
  number: string | undefined,
  text: string,
): string | null {
  const digits = (number ?? '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
