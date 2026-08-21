import type { LineProvider } from '@/app/hooks/use-line-subscription'

/**
 * Conectores que a tela mostra mas ainda **não** deixa contratar.
 *
 * O WhatsApp Oficial depende de um teste ponta a ponta com a HubMessage que ainda
 * não aconteceu. Até lá a opção continua visível — ela comunica o que vem por aí, e
 * some da tela seria pior para quem já perguntou pelo canal oficial — mas com o
 * botão travado e o selo "Em breve".
 *
 * **Um lugar só, de propósito.** A escolha do conector existe em dois fluxos
 * independentes (convite ao teste e criação de linha nova), e eram dois pontos onde
 * a liberação teria que ser lembrada. Esvaziar este conjunto reabre os dois de uma
 * vez.
 *
 * Isto é gate de **interface**: quem chamar a api direto não é barrado aqui. O
 * bloqueio de verdade, se precisar existir, mora na criação de linha do lado do
 * servidor.
 */
const UNAVAILABLE_PROVIDERS: ReadonlySet<LineProvider> = new Set<LineProvider>([
  'HUBMESSAGE',
])

export function isProviderUnavailable(provider: LineProvider): boolean {
  return UNAVAILABLE_PROVIDERS.has(provider)
}
