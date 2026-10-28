import type { PortalAppDetail } from '../entities/portal-domain'

/**
 * Leitura de uma instalação para o backoffice, só de `core_apps`/`core_domains`.
 *
 * `title` nasce igual a `appName` e `mirror` só distingue `no-mirror` de `unknown`: a
 * SPA 1060 entra depois, na hidratação, como na listagem.
 */
export interface PortalAppReadRepository {
  findById(appId: string): Promise<PortalAppDetail | null>
}
