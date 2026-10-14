import type { TutorialSlug } from '../content'
import { ACOMPANHAMENTO_VIEW } from './acompanhamento'
import { CONEXAO_VIEW } from './conexao'
import { GRUPO_VIEW } from './grupo'
import { INSTALACAO_VIEW } from './instalacao'
import { NEGOCIO_VIEW } from './negocio'
import { ROBO_VIEW } from './robo'
import type { TutorialView } from './shared/frame'

export const TUTORIAL_VIEWS: Record<TutorialSlug, TutorialView> = {
  instalacao: INSTALACAO_VIEW,
  conexao: CONEXAO_VIEW,
  negocio: NEGOCIO_VIEW,
  grupo: GRUPO_VIEW,
  robo: ROBO_VIEW,
  acompanhamento: ACOMPANHAMENTO_VIEW,
}
