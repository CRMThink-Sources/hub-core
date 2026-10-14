import { Plus } from 'lucide-react'
import {
  DEAL_FIELD_IDS,
  DEAL_FIELD_KINDS,
  type NegocioScreen,
} from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import {
  AdditionalCard,
  CompaniesCard,
  ConfiguracoesPage,
  ContactFieldsCard,
  SaveBar,
} from './shared/app-pages'
import { CrmBoard } from './shared/crm'
import {
  APP_PATH,
  Hotspot,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

// "Assinar como" fica sem passo: o valor cru vai como função à Clicksign (`build-signers.ts`).
const EXTRA: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}configuracoes`,
  menu: 'configuracoes',
}

export const NEGOCIO_VIEW: TutorialView<NegocioScreen> = {
  frames: {
    'crm-fields': {
      kind: 'bitrix',
      path: 'crm/configs/fields/CRM_DEAL/',
      menu: 'crm',
    },
    'extra-tab': EXTRA,
    additional: EXTRA,
    'contact-fields': EXTRA,
    'save-extra': EXTRA,
  },
  screens: {
    'crm-fields': CrmFieldsScreen,
    'extra-tab': ExtraTabScreen,
    additional: AdditionalScreen,
    'contact-fields': ContactFieldsScreen,
    'save-extra': SaveExtraScreen,
  },
}

function CrmFieldsScreen({ action, onAdvance }: ScreenProps) {
  const { crm, assinatura } = useLpContent().shared
  const { crmFields } = useTutorialScreens('negocio')

  return (
    <CrmBoard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-white">{crmFields.title}</p>
        <Hotspot
          action={action}
          onAdvance={onAdvance}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#bbed21] px-3 text-xs font-semibold text-[#535c69]"
        >
          <Plus aria-hidden className="size-3.5" />
          {crmFields.add}
        </Hotspot>
      </div>
      <div className="overflow-hidden rounded-lg bg-white text-xs">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] border-b border-[#eef2f4] px-3 py-2 font-semibold uppercase text-[#828b95]">
          <span>{crmFields.name}</span>
          <span>{crmFields.type}</span>
        </div>
        <ul className="divide-y divide-[#eef2f4]">
          {DEAL_FIELD_IDS.map(id => (
            <li
              key={id}
              className="grid grid-cols-[minmax(0,1fr)_6rem] px-3 py-2 text-[#333]"
            >
              <span className="truncate">{assinatura.fields[id].label}</span>
              <span className="text-[#828b95]">
                {crm.fieldKinds[DEAL_FIELD_KINDS[id]]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </CrmBoard>
  )
}

function ExtraTabScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <ConfiguracoesPage tab="principal" extraTab={props}>
      <CompaniesCard
        name={sample.companyName}
        token={sample.token}
        reminderDays={3}
      />
    </ConfiguracoesPage>
  )
}

function AdditionalScreen({ action, onAdvance }: ScreenProps) {
  return (
    <ConfiguracoesPage tab="extra">
      <AdditionalCard
        checked={[]}
        hotspot={{ action, onAdvance, id: 'officialDocument' }}
      />
    </ConfiguracoesPage>
  )
}

function ContactFieldsScreen(props: ScreenProps) {
  return (
    <ConfiguracoesPage tab="extra">
      <ContactFieldsCard filled={false} cpf={props} />
    </ConfiguracoesPage>
  )
}

function SaveExtraScreen(props: ScreenProps) {
  return (
    <ConfiguracoesPage tab="extra">
      <ContactFieldsCard filled />
      <SaveBar save={props} />
    </ConfiguracoesPage>
  )
}
