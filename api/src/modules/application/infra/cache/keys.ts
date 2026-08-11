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
 */
export const PLAN_CACHE_VERSION = 'v2'

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
 */
export const SUBSCRIPTION_CACHE_VERSION = 'v4'

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

export const planKey = (id: string) =>
  `payments:plan:${PLAN_CACHE_VERSION}:${id}`
export const planListKey = () => `payments:plans:${PLAN_CACHE_VERSION}:all`

export const subscriptionKey = (id: string) =>
  `payments:subscription:${SUBSCRIPTION_CACHE_VERSION}:${id}`
export const subscriptionListKey = () =>
  `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:all`
export const subscriptionsByAplicationKey = (aplicationSpaId: string) =>
  `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:aplication:${aplicationSpaId}`

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

export const SUBSCRIPTION_ITEM_SCAN_PATTERNS = [
  `payments:subscription-item:${SUBSCRIPTION_ITEM_CACHE_VERSION}:*`,
  `payments:subscription-items:${SUBSCRIPTION_ITEM_CACHE_VERSION}:*`,
]

/**
 * Padrão só das listagens por pai — o fallback de quando o pai não pode ser lido
 * (item apagado no CRM, leitura do Bitrix falhando). Apaga menos que a família
 * inteira: as entradas por id sobrevivem.
 */
export const SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN = `payments:subscriptions:${SUBSCRIPTION_CACHE_VERSION}:aplication:*`

export const SUBSCRIPTION_ITEMS_BY_SUBSCRIPTION_SCAN_PATTERN = `payments:subscription-items:${SUBSCRIPTION_ITEM_CACHE_VERSION}:subscription:*`
