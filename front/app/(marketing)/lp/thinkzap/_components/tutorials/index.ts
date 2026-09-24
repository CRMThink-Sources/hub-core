import type { TutorialSlug } from '../content'
import { API_OFICIAL_VIEW } from './api-oficial'
import { ATIVACAO_VIEW } from './ativacao'
import { GRUPOS_VIEW } from './grupos'
import { INSTALACAO_VIEW } from './instalacao'
import { ROBOS_VIEW } from './robos'
import type { TutorialView } from './shared/frame'
import { THINKBOT_VIEW } from './thinkbot'

/** Telas e molduras de cada tutorial, pelo slug de `content.ts`. */
export const TUTORIAL_VIEWS: Record<TutorialSlug, TutorialView> = {
  instalacao: INSTALACAO_VIEW,
  ativacao: ATIVACAO_VIEW,
  thinkbot: THINKBOT_VIEW,
  'api-oficial': API_OFICIAL_VIEW,
  robos: ROBOS_VIEW,
  grupos: GRUPOS_VIEW,
}
