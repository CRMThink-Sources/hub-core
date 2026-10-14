import {
  resolveLpLocale as resolveSharedLpLocale,
  type LpBaseContent,
  type LpFrameCopy,
  type Tutorial as LpTutorial,
} from '../../../_shared/content'
import type { AcompanhamentoCopy } from './pt/tutorials/acompanhamento'
import type { ConexaoCopy } from './pt/tutorials/conexao'
import type { GrupoCopy } from './pt/tutorials/grupo'
import type { InstalacaoCopy } from './pt/tutorials/instalacao'
import type { NegocioCopy } from './pt/tutorials/negocio'
import type { RoboCopy } from './pt/tutorials/robo'

export {
  tutorialTracks,
  type BitrixMenuId,
  type TutorialStep,
  type TutorialTrack,
  type TutorialVariant,
} from '../../../_shared/content'

export const LP_LOCALES = ['pt', 'en', 'es'] as const
export type LpLocale = (typeof LP_LOCALES)[number]

export function resolveLpLocale(raw: unknown): LpLocale {
  return resolveSharedLpLocale(raw, LP_LOCALES)
}

export type FeatureIcon =
  | 'robot'
  | 'mapping'
  | 'groups'
  | 'auth'
  | 'timeline'
  | 'signedFile'
  | 'companies'
  | 'cancel'

export type Tutorial<Screen extends string = string> = LpTutorial<
  Screen,
  TutorialSlug
>

export const TUTORIAL_SLUGS = [
  'instalacao',
  'conexao',
  'negocio',
  'grupo',
  'robo',
  'acompanhamento',
] as const
export type TutorialSlug = (typeof TUTORIAL_SLUGS)[number]

export type InstalacaoScreen = 'market' | 'market-app' | 'install'

export type ConexaoScreen =
  | 'name'
  | 'token'
  | 'environment'
  | 'reminder'
  | 'save'

export type NegocioScreen =
  | 'crm-fields'
  | 'extra-tab'
  | 'additional'
  | 'contact-fields'
  | 'save-extra'

export type GrupoScreen =
  | 'new-group'
  | 'group-id'
  | 'deal-fields'
  | 'default-contact'
  | 'add-participant'
  | 'participant'
  | 'save'

export type RoboScreen =
  | 'kanban'
  | 'stages'
  | 'catalog'
  | 'robot-token'
  | 'robot-group'
  | 'robot-sequence'
  | 'robot-save'
  | 'move-deal'

export type AcompanhamentoScreen =
  | 'sent'
  | 'signed'
  | 'finished'
  | 'refused'
  | 'cancel'
  | 'canceled'
  | 'error'

// Mesma ordem de `CLICKSIGN_ASIDE_CONFIG`.
export const APP_MENU_IDS = [
  'configuracoes',
  'assinatura',
  'logs',
  'ajuda',
] as const
export type AppMenuId = (typeof APP_MENU_IDS)[number]

// Mesma ordem de `EXTRA_CONFIGS` em `configuracoes-layout.tsx`.
export const EXTRA_IDS = [
  'selfie',
  'facialBiometrics',
  'handwritten',
  'officialDocument',
  'rubrica',
] as const
export type ExtraId = (typeof EXTRA_IDS)[number]

// O app não cria esses campos: o cliente cria antes, no CRM.
export const DEAL_FIELD_IDS = [
  'arquivo',
  'dataLimite',
  'documentoId',
  'status',
  'finalizado',
  'dataAssinatura',
  'arquivoAssinado',
] as const
export type DealFieldId = (typeof DEAL_FIELD_IDS)[number]

export type FieldKind = 'file' | 'date' | 'text'

export const DEAL_FIELD_KINDS: Record<DealFieldId, FieldKind> = {
  arquivo: 'file',
  dataLimite: 'date',
  documentoId: 'text',
  status: 'text',
  finalizado: 'text',
  dataAssinatura: 'date',
  arquivoAssinado: 'file',
}

// Mesma ordem dos pickers de `grupo-card.tsx`.
export const GROUP_FIELD_ORDER: DealFieldId[] = [
  'status',
  'arquivoAssinado',
  'dataAssinatura',
  'documentoId',
  'arquivo',
  'dataLimite',
  'finalizado',
]

export const STAGE_IDS = ['novo', 'proposta', 'contrato', 'ganho'] as const
export type StageId = (typeof STAGE_IDS)[number]

export type SignerStatus = 'waiting' | 'signed' | 'refused'

export type LpContent = LpBaseContent<FeatureIcon, LpLocale> & {
  hero: { eyebrow: string; title: string; subtitle: string }
  signPreview: {
    document: string
    sentFrom: string
    deal: string
    signers: { name: string; signed: boolean }[]
    signed: string
    waiting: string
    signedFile: string
  }
  frame: LpFrameCopy & {
    appMenu: Record<AppMenuId, string>
    poweredBy: string
    beta: string
  }
  shared: {
    select: string
    configuracoes: {
      tabPrincipal: string
      tabExtra: string
      companiesTitle: string
      companiesDescription: string
      newCompany: string
      tokenLabel: string
      tokenHint: string
      tokenPlaceholder: string
      environmentLabel: string
      environmentHint: string
      environments: { prod: string; sandbox: string }
      reminderLabel: string
      reminderHint: string
      reminderDays: (days: number) => string
      save: string
      additionalTitle: string
      extras: Record<ExtraId, string>
      facialBiometricsHint: string
      contactFieldsTitle: string
      contactFieldsDescription: string
      cpfLabel: string
      isForeignLabel: string
      signAsLabel: string
      signAsValue: string
      signAsHint: string
    }
    assinatura: {
      title: string
      description: string
      save: string
      newGroup: string
      empty: string
      group: string
      groupIdPlaceholder: string
      dealFields: string
      fields: Record<DealFieldId, { label: string; hint: string }>
      contactsTitle: string
      addContact: string
      participantsTitle: string
      add: string
      useDefaultContact: string
      useDefaultContactHint: string
      userLabel: string
      userHint: string
      roleLabel: string
      emailLabel: string
      emailPlaceholder: string
      isForeign: string
    }
    crm: {
      dealsTitle: string
      filterSearch: string
      stages: Record<StageId, string>
      fieldKinds: Record<FieldKind, string>
      dealLabel: (id: number, value: string) => string
      about: string
      timeline: string
      empty: string
    }
    card: {
      title: string
      intro: string
      header: (documentId: string, group: string) => string
      canceledHeader: (documentId: string) => string
      status: {
        progress: string
        finished: string
        refused: string
        canceled: string
      }
      signer: Record<SignerStatus, string>
      cancel: string
    }
    sample: {
      companyName: string
      companyDraft: string
      token: string
      groupId: string
      documentId: string
      deal: { title: string; contact: string; value: string }
      signers: { name: string; email: string }[]
      user: string
      role: string
      fileName: string
      signedFileName: string
      signedAt: string
      yes: string
      cpfField: string
      foreignField: string
    }
  }
  tutorials: {
    instalacao: InstalacaoCopy
    conexao: ConexaoCopy
    negocio: NegocioCopy
    grupo: GrupoCopy
    robo: RoboCopy
    acompanhamento: AcompanhamentoCopy
  }
}
