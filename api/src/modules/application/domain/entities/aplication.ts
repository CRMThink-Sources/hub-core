import { Customer } from './customer'

/**
 * Instalação de um app num portal — a unidade que uma assinatura paga.
 *
 * A fonte de verdade é `core_apps`, escrita no install/uninstall e com restrição
 * única em `(domain_id, app_code_id)`. O item da SPA 1060 é **espelho**: pode ter
 * duplicata, pode ser criado à mão, e o `STATUS` dele fala de assinatura
 * (`active`/`trialing`/`past_due`/`canceled`), não de "app instalado".
 *
 * Não tem `product` de propósito: nada liga a SPA de produtos (1134) a um app
 * code, e o produto de uma cobrança é alcançado por `subscription.plan.product`.
 */
export interface Aplication {
  /** Uuid de `core_apps` — a fonte de verdade. */
  id: string
  /**
   * Id do item espelho na SPA 1060. `null` é estado válido: instalação criada
   * antes do backfill, ou falha na criação do item. Só bloqueia o que precisa do
   * id da SPA — criar assinatura, que o grava no campo parent.
   */
  spaId: string | null
  /** Portal dono da instalação, de `core_domains` via `domain_id`. */
  customer: Customer
  /**
   * Identificador do app na plataforma (`crmthink.thinkzap`) — a coluna
   * `core_app_codes.id`, que é o valor gravado no campo `APP_CODE` do item da
   * SPA 1060. **Não** é `core_app_codes.code`, que guarda o id do app no
   * marketplace do Bitrix e muda por ambiente.
   */
  appCode: string
  /**
   * `title` do item da SPA 1060. Quando não há espelho, ou o Bitrix não devolve
   * o item, cai para `core_app_codes.name`.
   */
  title: string
  /** Derivado de `core_apps.status === 'ACTIVE'`. */
  active: boolean
  /** `core_apps.installed_at`. */
  createdAt: Date
  updatedAt: Date
}
