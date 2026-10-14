import type { ConexaoScreen } from '../content'
import { useLpContent } from '../content/locale-context'
import {
  CompaniesCard,
  ConfiguracoesPage,
  SaveBar,
  type CompanyTarget,
} from './shared/app-pages'
import {
  APP_PATH,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

// Sem passo de segredo: ao salvar, `update-settings` registra sozinho o retorno de status na Clicksign.
const SETTINGS: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}configuracoes`,
  menu: 'configuracoes',
}

export const CONEXAO_VIEW: TutorialView<ConexaoScreen> = {
  frames: {
    name: SETTINGS,
    token: SETTINGS,
    environment: SETTINGS,
    reminder: SETTINGS,
    save: SETTINGS,
  },
  screens: {
    name: props => <CompanyScreen {...props} target="name" />,
    token: props => <CompanyScreen {...props} target="token" />,
    environment: props => <CompanyScreen {...props} target="environment" />,
    reminder: props => <CompanyScreen {...props} target="reminder" />,
    save: SaveScreen,
  },
}

const ORDER: CompanyTarget[] = ['name', 'token', 'environment', 'reminder']

function CompanyScreen({
  target,
  ...props
}: ScreenProps & { target: CompanyTarget }) {
  const { sample } = useLpContent().shared
  const step = ORDER.indexOf(target)

  return (
    <ConfiguracoesPage tab="principal">
      <CompaniesCard
        name={target === 'name' ? sample.companyDraft : sample.companyName}
        token={step >= 1 ? sample.token : null}
        hotspot={{ ...props, target }}
      />
      <SaveBar />
    </ConfiguracoesPage>
  )
}

function SaveScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared

  return (
    <ConfiguracoesPage tab="principal">
      <CompaniesCard
        name={sample.companyName}
        token={sample.token}
        reminderDays={3}
      />
      <SaveBar save={props} />
    </ConfiguracoesPage>
  )
}
