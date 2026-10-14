import type { TutorialSlug } from '../content'
import { AGENDAMENTO_VIEW } from './agendamento'
import { ERROS_VIEW } from './erros'
import { GOOGLE_VIEW } from './google'
import { INSTALACAO_VIEW } from './instalacao'
import { MAPEAMENTO_VIEW } from './mapeamento'
import { NOVA_IMPORTACAO_VIEW } from './nova-importacao'
import type { TutorialView } from './shared/frame'

export const TUTORIAL_VIEWS: Record<TutorialSlug, TutorialView> = {
  instalacao: INSTALACAO_VIEW,
  google: GOOGLE_VIEW,
  'nova-importacao': NOVA_IMPORTACAO_VIEW,
  mapeamento: MAPEAMENTO_VIEW,
  agendamento: AGENDAMENTO_VIEW,
  erros: ERROS_VIEW,
}
