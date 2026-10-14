import type { LpCtas } from '../../_shared/resolve-ctas'
import { TutorialsSection } from '../../_shared/tutorials-section'
import type { LpContent } from './content'
import { allTutorialHashes } from './tutorial-hash'
import { TutorialTabs } from './tutorial-tabs'

export function HowItWorks({
  content,
  ...ctas
}: LpCtas & { content: LpContent }) {
  const anchors = allTutorialHashes().map(hash => hash.slice(1))

  return (
    <TutorialsSection copy={content.tutorialsSection} anchors={anchors}>
      <TutorialTabs ctas={ctas} locale={content.locale} />
    </TutorialsSection>
  )
}
