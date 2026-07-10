import type { Provider } from '../types'

export const PROVIDERS: {
  value: Provider
  label: string
  disabled?: boolean
}[] = [
  { value: 'asaas', label: 'Asaas' },
  { value: 'bling', label: 'Bling' },
  { value: 'conta_azul', label: 'Conta Azul' },
  { value: 'sonax', label: 'Sonax' },
  { value: 'omie', label: 'Omie' },
]

// Providers que conectam via popup OAuth (botão "conectar") em vez de credencial
export type OAuthProviderConfig = {
  startPath: string
  // type do postMessage emitido pelo popup de callback (ver oauth-popup-html.ts na api)
  messageType: string
  connectLabelKey: string
  reconnectLabelKey: string
  // Conta Azul (Cognito) reusa sessão logada — abrir via /logout força novo login
  preferLogoutUrl?: boolean
}

export const OAUTH_PROVIDERS: Partial<Record<Provider, OAuthProviderConfig>> = {
  conta_azul: {
    startPath: '/thinkanalise/oauth/conta-azul/start',
    messageType: 'conta-azul-oauth',
    connectLabelKey: 'botoes.salvarConectarContaAzul',
    reconnectLabelKey: 'botoes.reconectarContaAzul',
    preferLogoutUrl: true,
  },
  bling: {
    startPath: '/thinkanalise/oauth/bling/start',
    messageType: 'bling-oauth',
    connectLabelKey: 'botoes.salvarConectarBling',
    reconnectLabelKey: 'botoes.reconectarBling',
  },
}

export const OAUTH_MESSAGE_TYPES = Object.values(OAUTH_PROVIDERS).map(
  p => p.messageType,
)
