import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'

/**
 * A identidade do contato no canal aberto do Bitrix — o valor que vai em `chat.id` e
 * `user.id` de `imconnector.send.messages`.
 *
 * **Isto não é formatação de exibição.** Para o Bitrix, `chat.id` *é* a identidade da
 * sessão de canal aberto e do contato: dois valores diferentes para o mesmo contato
 * são dois contatos, e o Bitrix abre duas conversas. Todo ponto que constrói esse
 * payload — envio pelo widget, inbound da Z-API, inbound da HubMessage — tem que
 * passar por aqui, porque a divergência que este helper corrige nasceu exatamente de
 * cada um decidir por conta própria.
 *
 * **Por que canonizar e não preservar o valor cru.** O cru não é o mesmo nas duas
 * direções: quem inicia pelo widget digita o número na tela do CRM, quem responde
 * chega pelo provider, e os dois escrevem o mesmo telefone de formas diferentes — com
 * e sem o 9º dígito de celular BR, com e sem `+`, com e sem `55`. Preservar o cru
 * preserva o desencontro; `normalizePhoneNumber` colapsa as formas equivalentes num
 * único valor, que é o que faz envio e resposta se encontrarem na mesma sessão.
 *
 * **Consequência que precisa ficar dita:** `normalizePhoneNumber` passou a ser
 * identidade **persistida no Bitrix**. Mudar a heurística dela — um país novo, um
 * ajuste na regra do 9º dígito — parte as sessões de canal aberto dos contatos
 * daquele padrão, do mesmo jeito que esta mudança parte as sessões abertas antes
 * dela. Não há proteção mecânica contra isso; a proteção é este parágrafo.
 *
 * `@lid` e `-group` escapam da canonização porque não há telefone a canonizar: `@lid`
 * é contato em modo privacidade, onde o WhatsApp não expõe o número, e `-group` é jid
 * de grupo. Nenhum dos dois pode ser iniciado pelo widget — que precisa de um número
 * — então nenhum dos dois tem a divergência que este helper resolve.
 */
export const resolveOpenChannelContactId = (raw: string): string => {
  if (raw.includes('@lid') || raw.includes('-group')) {
    return raw
  }

  return normalizePhoneNumber(raw)
}
