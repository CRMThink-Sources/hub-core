/**
 * Contrato neutro para o ciclo de vida de templates de mensagem de um conector,
 * independente do provider concreto (HubMessage hoje; Z-API não oficial no
 * roadmap deles). As implementações vivem em `infra` como adapters e NÃO devem
 * vazar tipos específicos de provider para a camada de aplicação.
 *
 * Templates são escopados por WABA (WhatsApp Business Account): o adapter recebe
 * o `wabaId` já resolvido a partir do conector.
 */

/** Categoria exigida pela Meta na criação do template. */
export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'

/** Status de aprovação do template na Meta. */
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * Componente de um template. A estrutura de `HEADER`/`BUTTONS` varia; o contrato
 * mantém `text` opcional (BODY/FOOTER) e um saco de campos extras neutro para não
 * acoplar ao formato de um provider específico.
 */
export type TemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  /** Campos adicionais específicos do componente (formato, botões, exemplos). */
  [key: string]: unknown
}

/**
 * Botão de template no formato de **cadastro** da Meta — os quatro tipos que o
 * formulário cria. Na leitura do catálogo o `BUTTONS` continua cru dentro de
 * `TemplateComponent` (template criado direto na Meta pode ter tipos que não estão
 * aqui); quem precisa dos botões lidos usa `templateButtonsOf`.
 *
 * `URL` dinâmica termina em `{{1}}` e exige `example` com a URL completa.
 * `COPY_CODE` não tem `text`: o rótulo é fixo do WhatsApp.
 */
export type TemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example?: string[] }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  | { type: 'COPY_CODE'; example: string }

export type TemplateButtonType = TemplateButton['type']

/** Template já cadastrado, na forma neutra do domínio. */
export type Template = {
  id: string
  name: string
  category: TemplateCategory
  language: string
  status: TemplateStatus
  components: TemplateComponent[]
}

/** Dados para cadastrar um novo template (submetido à aprovação da Meta). */
export type CreateTemplateInput = {
  wabaId: string
  name: string
  category: TemplateCategory
  language: string
  components: TemplateComponent[]
}

/** Resultado do cadastro: id remoto criado e status inicial (normalmente PENDING). */
export type CreatedTemplate = {
  id: string
  status: TemplateStatus
  category: TemplateCategory
}

export interface WhatsAppTemplateProvider {
  /** Sinaliza se o provider suporta templates. `false` → operações lançam erro. */
  readonly supportsTemplates: boolean

  /** Lista os templates de uma WABA. */
  listTemplates(wabaId: string): Promise<Template[]>

  /** Cadastra um novo template e submete à aprovação da Meta. */
  createTemplate(input: CreateTemplateInput): Promise<CreatedTemplate>

  /** Força sincronização de status com a Meta e retorna os templates atualizados. */
  syncTemplates(wabaId: string): Promise<Template[]>
}
