/**
 * Abas da tela de aplicação do backoffice e o valor delas no endereço (`?aba=`).
 *
 * O valor da URL é o slug em português, que é o que o suporte cola no chamado; a chave
 * de i18n é separada para o rótulo poder ser traduzido sem mudar link nenhum.
 */
export const APP_TAB_PARAM = 'aba'

export const GENERAL_TABS = ['visao-geral', 'assinaturas'] as const
/** Só ThinkZap: as linhas e o grupo técnico dependem de recursos do app. */
export const THINKZAP_TABS = ['linhas'] as const
export const TECHNICAL_TABS = [
  'implantacao',
  'placements',
  'robos',
  'provedores-sms',
] as const

export type AppTab =
  | (typeof GENERAL_TABS)[number]
  | (typeof THINKZAP_TABS)[number]
  | (typeof TECHNICAL_TABS)[number]

export const DEFAULT_APP_TAB: AppTab = 'visao-geral'

export const APP_TAB_LABEL_KEY: Record<AppTab, string> = {
  'visao-geral': 'tabs.overview',
  assinaturas: 'tabs.subscriptions',
  linhas: 'tabs.instances',
  implantacao: 'tabs.deployment',
  placements: 'tabs.placements',
  robos: 'tabs.bizproc',
  'provedores-sms': 'tabs.smsProviders',
}

/** As abas que a aplicação tem, em ordem. */
export function availableAppTabs(isThinkzap: boolean): AppTab[] {
  return isThinkzap
    ? [...GENERAL_TABS, ...THINKZAP_TABS, ...TECHNICAL_TABS]
    : [...GENERAL_TABS]
}

export const isTechnicalTab = (tab: AppTab): boolean =>
  (TECHNICAL_TABS as readonly string[]).includes(tab)

/**
 * A aba do endereço, se ela existe para esta aplicação; senão a padrão. Link de aba de
 * ThinkZap aberto numa app que não é ThinkZap cai na Visão geral em vez de tela vazia.
 */
export function resolveAppTab(
  raw: string | null | undefined,
  isThinkzap: boolean,
): AppTab {
  const tabs = availableAppTabs(isThinkzap)
  return raw && (tabs as string[]).includes(raw)
    ? (raw as AppTab)
    : DEFAULT_APP_TAB
}
