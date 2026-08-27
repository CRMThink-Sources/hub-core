import { env } from '@/config/env'

/**
 * Chaves do cache Redis do módulo `payments`, num lugar só.
 *
 * Os construtores e as versões viviam dentro de cada repositório cacheado, o que
 * bastava enquanto só o repositório apagava as próprias chaves. Com o webhook de
 * saída das SPAs invalidando de fora, a versão passou a existir em dois lados — e
 * subir `CACHE_VERSION` num repositório sem lembrar do invalidador o deixaria
 * apagando chaves de um deploy anterior, **em silêncio**, com o sintoma sendo
 * exatamente o cache velho que o webhook existe para corrigir.
 *
 * Cada família expõe também os padrões de `SCAN` que apagam a família inteira.
 * Eles são necessários porque as entidades são aninhadas no cache: a entrada de
 * assinatura guarda cópia do plano (com o produto) e da aplicação hidratada, e não
 * existe índice reverso de "quais assinaturas embutem este plano".
 *
 * **Quem carrega price id é escopado por ambiente do gateway.** As chaves de
 * aplicação não têm prefixo de ambiente — só o BullMQ tem, via `QUEUE_PREFIX` — e
 * dois ambientes podem apontar para o mesmo Redis e o mesmo índice de DB. Como
 * produção e homologação compartilham o mesmo portal Bitrix e a mesma SPA de planos,
 * o que difere entre eles é justamente o price id: sem o ambiente na chave, produção
 * serviria a entrada gravada pela homologação. O sintoma pior não é cobrar errado, é
 * `plan.gatewayId` ausente — e `isTrialSubscription` deriva "é trial" da ausência de
 * price id, então uma assinatura paga passaria por trial e a linha ficaria de graça.
 *
 * Vale para **plano e assinatura**: a entrada de assinatura embute o plano. Produto e
 * item de assinatura não carregam price id e ficam de fora.
 */

/**
 * Versão do shape do `Product`. Sobe junto com qualquer mudança na entidade
 * para que entradas gravadas por um deploy anterior sejam ignoradas.
 */
export const PRODUCT_CACHE_VERSION = 'v1'

/**
 * Versão do shape do `Plan`. Sobe junto com qualquer mudança na entidade
 * — inclusive no `Product` aninhado — para que entradas gravadas por um
 * deploy anterior sejam ignoradas.
 *
 * `v2`: `provider` entrou no shape. Entrada `v1` não tem o campo, e como ele é
 * opcional o schema **aceitaria** a entrada velha — resolvendo `undefined` e
 * tornando o plano pago não ofertável até o TTL vencer. Subir a versão é o que
 * evita uma janela de 5 min em que o checkout fica vazio depois do deploy.
 *
 * `v3`: o ambiente do gateway entrou na **chave**, e não no shape. A versão sobe
 * porque as entradas `v2` não têm o segmento de ambiente: elas continuariam vivas
 * até o TTL e seriam servidas pelo padrão antigo a quem ainda o lesse. Aqui a versão
 * não protege de shape incompatível, protege de entrada ambígua.
 *
 */
export const PLAN_CACHE_VERSION = 'v3'

/**
 * Versão do shape do preço lido do gateway.
 *
 * Família nova, então começa em `v1`. Sobe quando a forma do preço mudar — um modo de
 * escalonamento novo, `flat_amount` nos degraus —, porque entrada gravada sob a forma
 * antiga passaria pelo schema e alimentaria o cálculo com um preço incompleto.
 */
export const PLAN_PRICE_CACHE_VERSION = 'v1'

/**
 * Versão do shape da assinatura lida do gateway.
 *
 * Família nova, então começa em `v1`. Sobe quando a forma mudar — um campo novo no
 * item, ou o status ganhando valor —, porque entrada gravada sob a forma antiga
 * passaria pelo schema e alimentaria a derivação de bonificado com um item
 * incompleto. E item incompleto ali não vira erro: vira linha contada como
 * bonificada, que é o pior desfecho possível desta família.
 */
export const GATEWAY_SUBSCRIPTION_CACHE_VERSION = 'v1'

/**
 * Versão do shape do `Subscription`. Sobe junto com qualquer mudança na
 * entidade — inclusive no `Plan`, no `Product` e na `Aplication` aninhados —
 * para que entradas gravadas por um deploy anterior sejam ignoradas.
 *
 * `v2`: `customer: string` deu lugar a `aplication` hidratada e a assinatura
 * ganhou `product` próprio. Sem subir a versão, toda entrada do deploy anterior
 * viraria `warn` de shape velho em massa.
 *
 * `v3`: `product` próprio removido — a SPA 1142 não tem campo de produto, e o
 * produto cobrado é `plan.product`. Entradas `v2` têm `product` na raiz e
 * falhariam no schema; subir a versão as ignora em silêncio em vez de gerar
 * `warn` para cada uma.
 *
 * `v4`: `modality` entrou no shape. Entrada `v3` não tem o campo e reprovaria no
 * schema; subir a versão descarta as antigas de forma determinística, ao custo de
 * uma leitura ao Bitrix por instalação no primeiro acesso depois do deploy.
 *
 * `v5`: o ambiente do gateway entrou na chave. A entrada embute o plano, logo embute
 * o price id — e uma entrada gravada pela homologação servida à produção traz
 * `plan.gatewayId` do ambiente errado, ou ausente. Ausente é o caso ruim: a
 * assinatura paga passaria por trial, porque é da ausência de price id que
 * `isTrialSubscription` deriva "é trial".
 *
 */
export const SUBSCRIPTION_CACHE_VERSION = 'v5'

/**
 * Versão do shape do `SubscriptionItem`. Sobe junto com qualquer mudança na
 * entidade, para que entradas gravadas por um deploy anterior sejam ignoradas.
 *
 * Diferente de assinatura, **não** depende do shape de `Plan`, `Product` nem
 * `Aplication`: o item não aninha nenhuma outra entidade — `subscription` é o id
 * do pai. Mudança em plano ou produto não invalida cache de item.
 *
 * `v2`: `settings` entrou na entidade. `v3`: `vinculatedChannel` também. Subir a
 * versão torna o descarte de entradas antigas determinístico, em vez de depender de
 * o schema reprová-las.
 *
 * `v4`: `wabaId` do HubMessage passou a ser opcional. Aqui a versão sobe por um motivo
 * diferente dos anteriores — o schema novo **aceitaria** as entradas `v3`, porque
 * opcional é mais permissivo. O problema é o inverso: um item gravado em `v3` só
 * existia **com** WABA, e canal sem WABA era erro de leitura. Manter `v3` misturaria
 * entradas de dois regimes de validação diferentes na mesma chave.
 */
export const SUBSCRIPTION_ITEM_CACHE_VERSION = 'v4'

export const productKey = (id: string) =>
  `payments:product:${PRODUCT_CACHE_VERSION}:${id}`
export const productListKey = () =>
  `payments:products:${PRODUCT_CACHE_VERSION}:all`

/**
 * O ambiente do gateway como segmento de chave.
 *
 * Lido de `env` a cada chamada, e não capturado numa constante de módulo, para o
 * teste poder trocar o ambiente sem recarregar o módulo — e porque o custo é uma
 * leitura de propriedade.
 */
const gatewayEnvironment = () => env.payments.stripe.environment

/**
 * Preço lido do gateway, por **price id**.
 *
 * Família própria, fora do plano: o preço não é invalidado quando o plano muda na SPA
 * — editar o título de um plano no CRM não mexe no price do gateway —, e o plano é
 * lido por caminhos que não podem tocar o gateway.
 *
 * O ambiente não entra na chave porque **o price id já o identifica**: cada conta do
 * gateway tem os seus, e dois ambientes nunca compartilham um. É o oposto do plano,
 * cujo id é o mesmo nos dois porque a SPA é compartilhada.
 */
export const planPriceKey = (priceId: string) =>
  `payments:plan-price:${PLAN_PRICE_CACHE_VERSION}:${priceId}`

/**
 * Assinatura lida do gateway, por **id da assinatura no gateway**.
 *
 * Família própria, fora de `subscription:`, que é a assinatura da SPA. As duas
 * descrevem o mesmo contrato por ângulos diferentes — a SPA diz o que existe, o
 * gateway diz o que é cobrado — e juntá-las na mesma chave faria a invalidação de uma
 * descartar a outra sem motivo.
 *
 * O ambiente não entra na chave, pelo mesmo argumento de `planPriceKey`: o id
 * (`sub_...`) é emitido pela conta do gateway, e dois ambientes nunca compartilham um.
 * É o oposto do plano e da assinatura da SPA, cujos ids vêm de SPAs compartilhadas
 * entre produção e homologação.
 */
export const gatewaySubscriptionKey = (gatewaySubscriptionId: string) =>
  `payments:gateway-subscription:${GATEWAY_SUBSCRIPTION_CACHE_VERSION}:${gatewaySubscriptionId}`

export const planKey = (id: string) =>
  `payments:plan:${PLAN_CACHE_VERSION}:${gatewayEnvironment()}:${id}`
export const planListKey = () =>
  `payments:plans:${PLAN_CACHE_VERSION}:${gatewayEnvironment()}:all`

export const subscriptionKey = (id: string) =>
  `payments:subscription:${SUBSCRIPTION_CACHE_VERSION}:${gatewayEnvironment()}:${id}`
export const subscriptionListKey = () =>
  `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:${gatewayEnvironment()}:all`
export const subscriptionsByAplicationKey = (aplicationSpaId: string) =>
  `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:${gatewayEnvironment()}:aplication:${aplicationSpaId}`

export const subscriptionItemKey = (id: string) =>
  `payments:subscription-item:${SUBSCRIPTION_ITEM_CACHE_VERSION}:${id}`
export const subscriptionItemListKey = () =>
  `payments:subscription-items:${SUBSCRIPTION_ITEM_CACHE_VERSION}:all`
export const subscriptionItemsBySubscriptionKey = (subscriptionId: string) =>
  `payments:subscription-items:${SUBSCRIPTION_ITEM_CACHE_VERSION}:subscription:${subscriptionId}`

/**
 * Padrões de `SCAN` por família.
 *
 * São **dois** por família de propósito: o prefixo singular (`payments:plan:`)
 * guarda as entradas por id e o plural (`payments:plans:`) as listagens. Um padrão
 * único como `payments:subscription*` alcançaria também
 * `payments:subscription-item*` — apagaria o cache de itens em toda invalidação de
 * assinatura, que é o caminho mais quente que existe aqui.
 *
 * Nas famílias escopadas por ambiente, o padrão para **antes** do segmento de
 * ambiente e portanto apaga os dois. É o que se quer: o item mudou na SPA, que é
 * compartilhada, então a cópia dos dois ambientes está velha.
 */
export const PRODUCT_SCAN_PATTERNS = [
  `payments:product:${PRODUCT_CACHE_VERSION}:*`,
  `payments:products:${PRODUCT_CACHE_VERSION}:*`,
]

export const PLAN_SCAN_PATTERNS = [
  `payments:plan:${PLAN_CACHE_VERSION}:*`,
  `payments:plans:${PLAN_CACHE_VERSION}:*`,
]

export const SUBSCRIPTION_SCAN_PATTERNS = [
  `payments:subscription:${SUBSCRIPTION_CACHE_VERSION}:*`,
  `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:*`,
]

/**
 * Padrão da família inteira, para o caso de precisar limpá-la de fora.
 *
 * Singular só: esta família não tem listagem — a leitura é sempre por id de
 * assinatura. O padrão para no id, então `payments:gateway-subscription:v1:*` não
 * alcança nenhuma outra família.
 */
export const GATEWAY_SUBSCRIPTION_SCAN_PATTERNS = [
  `payments:gateway-subscription:${GATEWAY_SUBSCRIPTION_CACHE_VERSION}:*`,
]

export const SUBSCRIPTION_ITEM_SCAN_PATTERNS = [
  `payments:subscription-item:${SUBSCRIPTION_ITEM_CACHE_VERSION}:*`,
  `payments:subscription-items:${SUBSCRIPTION_ITEM_CACHE_VERSION}:*`,
]

/**
 * Padrão só das listagens por pai — o fallback de quando o pai não pode ser lido
 * (item apagado no CRM, leitura do Bitrix falhando). Apaga menos que a família
 * inteira: as entradas por id sobrevivem.
 */
/**
 * O `*` do meio é o segmento de ambiente do gateway. Ele **tem** que estar aqui: com
 * `...:${VERSÃO}:aplication:*` o padrão deixou de casar no dia em que o ambiente
 * entrou na chave, e varredura que não casa nada não dá erro — dá cache velho
 * servido, que é exatamente o que a invalidação existe para evitar.
 */
export const SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN = `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:*:aplication:*`

export const SUBSCRIPTION_ITEMS_BY_SUBSCRIPTION_SCAN_PATTERN = `payments:subscription-items:${SUBSCRIPTION_ITEM_CACHE_VERSION}:subscription:*`
