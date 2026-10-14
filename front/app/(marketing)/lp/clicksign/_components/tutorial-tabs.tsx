'use client'

import type { LpCtas } from '../../_shared/resolve-ctas'
import { TutorialTabs as LpTutorialTabs } from '../../_shared/tutorial-tabs'
import { getLpContent, tutorialsOf, type LpLocale } from './content'
import { TUTORIAL_VIEWS } from './tutorials'
import { AppAside } from './tutorials/shared/frame'

export function TutorialTabs({
  ctas,
  locale,
}: {
  ctas: LpCtas
  // Só o idioma cruza a fronteira server/client; o dicionário é importado aqui.
  locale: LpLocale
}) {
  const content = getLpContent(locale)
  return (
    <LpTutorialTabs
      content={content}
      tutorials={tutorialsOf(content)}
      views={TUTORIAL_VIEWS}
      appAside={AppAside}
      ctas={ctas}
    />
  )
}
