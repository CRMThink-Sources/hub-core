import type { MapeamentoScreen } from '../content'
import {
  ConfigureDialog,
  DestinationSection,
  IdentitySection,
  MappingTable,
  OptionsSection,
  ResponsibleSection,
} from './shared/app-pages'
import {
  APP_PATH,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

// Cada passo mostra as seções em volta do destaque, não o diálogo inteiro.
const APP: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}importacoes`,
  menu: 'importacoes',
}

export const MAPEAMENTO_VIEW: TutorialView<MapeamentoScreen> = {
  frames: {
    identity: APP,
    entity: APP,
    responsible: APP,
    options: APP,
    mapping: APP,
    identifier: APP,
    save: APP,
  },
  screens: {
    identity: IdentityScreen,
    entity: EntityScreen,
    responsible: ResponsibleScreen,
    options: OptionsScreen,
    mapping: MappingScreen,
    identifier: IdentifierScreen,
    save: SaveScreen,
  },
}

function IdentityScreen(props: ScreenProps) {
  return <ConfigureDialog top={<IdentitySection startRow={props} />} />
}

function EntityScreen(props: ScreenProps) {
  return (
    <ConfigureDialog
      top={
        <>
          <IdentitySection />
          <DestinationSection entity={props} />
        </>
      }
    >
      <ResponsibleSection />
      <OptionsSection contactOn={false} />
    </ConfigureDialog>
  )
}

function ResponsibleScreen(props: ScreenProps) {
  return (
    <ConfigureDialog top={<DestinationSection />}>
      <ResponsibleSection matchBy={props} />
      <OptionsSection contactOn={false} />
    </ConfigureDialog>
  )
}

function OptionsScreen(props: ScreenProps) {
  return (
    <ConfigureDialog top={<DestinationSection />}>
      <ResponsibleSection />
      <OptionsSection contactOn={false} createContact={props} />
    </ConfigureDialog>
  )
}

function MappingScreen(props: ScreenProps) {
  return (
    <ConfigureDialog>
      <OptionsSection contactOn />
      <MappingTable destination={props} />
    </ConfigureDialog>
  )
}

function IdentifierScreen(props: ScreenProps) {
  return (
    <ConfigureDialog>
      <OptionsSection contactOn />
      <MappingTable identifier={props} />
    </ConfigureDialog>
  )
}

function SaveScreen(props: ScreenProps) {
  return (
    <ConfigureDialog save={props}>
      <OptionsSection contactOn />
      <MappingTable identifierChecked />
    </ConfigureDialog>
  )
}
