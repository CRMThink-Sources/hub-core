import { createTutorialHash } from '../../_shared/tutorial-hash'
import { getLpContent, tutorialsOf } from './content'

export const {
  DEFAULT_TUTORIAL,
  tutorialHash,
  isTutorialHash,
  allTutorialHashes,
  resolveTutorialHash,
} = createTutorialHash(tutorialsOf(getLpContent('pt')), 'instalacao')
