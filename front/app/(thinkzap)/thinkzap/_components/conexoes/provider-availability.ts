import type { LineProvider } from '@/app/hooks/use-line-subscription'
import { envConfig } from '@/shared/infra/env-config'

/**
 * Conectores que a tela mostra mas ainda **não** deixa contratar.
 *
 * A lista de liberados vem do ambiente (`NEXT_PUBLIC_THINKZAP_ENABLED_PROVIDERS`),
 * e não do código: homologação e produção rodam o mesmo bundle e precisam de
 * respostas diferentes. Sem a variável vale o padrão conservador — só `ZAPI` —
 * para que um ambiente esquecido não abra contratação por acidente. Por ser
 * `NEXT_PUBLIC_*`, o valor é inlinado no build: mudar a lista exige rebuildar a
 * imagem daquele ambiente.
 *
 * O conector não liberado continua visível, com o botão travado e o selo
 * "Em breve". Sumir esconderia um canal que o cliente pergunta se existe;
 * deixar clicável entregaria uma linha que ninguém consegue conectar ainda.
 *
 * **Um lugar só, de propósito.** A escolha do conector existe em dois fluxos
 * independentes (convite ao teste e criação de linha nova), e eram dois pontos onde
 * a liberação teria que ser lembrada.
 *
 * Isto é gate de **interface**: quem chamar a api direto não é barrado aqui. O
 * bloqueio de verdade, se precisar existir, mora na criação de linha do lado do
 * servidor.
 */
export function isProviderUnavailable(provider: LineProvider): boolean {
  return !envConfig.enabledLineProviders.includes(provider)
}
