import type { GrupoScreen } from '../content'
import { useLpContent } from '../content/locale-context'
import {
  AssinaturaPage,
  ContactsSection,
  DealFieldsSection,
  EmptyGroups,
  GroupCard,
  ParticipantsSection,
} from './shared/app-pages'
import {
  APP_PATH,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

// Cada tela mostra só as seções do passo, para a janela não crescer demais.
const GROUPS: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}assinatura`,
  menu: 'assinatura',
}

export const GRUPO_VIEW: TutorialView<GrupoScreen> = {
  frames: {
    'new-group': GROUPS,
    'group-id': GROUPS,
    'deal-fields': GROUPS,
    'default-contact': GROUPS,
    'add-participant': GROUPS,
    participant: GROUPS,
    save: GROUPS,
  },
  screens: {
    'new-group': NewGroupScreen,
    'group-id': GroupIdScreen,
    'deal-fields': DealFieldsScreen,
    'default-contact': DefaultContactScreen,
    'add-participant': AddParticipantScreen,
    participant: ParticipantScreen,
    save: SaveScreen,
  },
}

function NewGroupScreen(props: ScreenProps) {
  return (
    <AssinaturaPage newGroup={props}>
      <EmptyGroups />
    </AssinaturaPage>
  )
}

function GroupIdScreen(props: ScreenProps) {
  return (
    <AssinaturaPage>
      <GroupCard id={null} idHotspot={props}>
        <DealFieldsSection filled={false} />
      </GroupCard>
    </AssinaturaPage>
  )
}

function DealFieldsScreen({ action, onAdvance }: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <AssinaturaPage>
      <GroupCard id={sample.groupId}>
        <DealFieldsSection
          filled
          hotspot={{ action, onAdvance, field: 'arquivo' }}
        />
      </GroupCard>
    </AssinaturaPage>
  )
}

function DefaultContactScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <AssinaturaPage>
      <GroupCard id={sample.groupId}>
        <ContactsSection defaultOn toggle={props} />
        <ParticipantsSection filled={false} />
      </GroupCard>
    </AssinaturaPage>
  )
}

function AddParticipantScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <AssinaturaPage>
      <GroupCard id={sample.groupId}>
        <ContactsSection defaultOn />
        <ParticipantsSection filled={false} add={props} />
      </GroupCard>
    </AssinaturaPage>
  )
}

function ParticipantScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <AssinaturaPage>
      <GroupCard id={sample.groupId}>
        <ParticipantsSection filled role={props} />
      </GroupCard>
    </AssinaturaPage>
  )
}

function SaveScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <AssinaturaPage save={props}>
      <GroupCard id={sample.groupId} collapsed />
    </AssinaturaPage>
  )
}
