import { RotateCwIcon } from 'lucide-react'
import type { ErrosScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import {
  ConfiguracoesPage,
  GoogleCard,
  ImportacoesPage,
  ImportRow,
  NotifyCard,
  useSampleImport,
} from './shared/app-pages'
import {
  APP_PATH,
  DialogOver,
  Hotspot,
  OutlineButton,
  PrimaryButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

const IMPORTS: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}importacoes`,
  menu: 'importacoes',
}
const SETTINGS: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}configuracoes`,
  menu: 'configuracoes',
}

export const ERROS_VIEW: TutorialView<ErrosScreen> = {
  frames: { list: IMPORTS, errors: IMPORTS, notify: SETTINGS, save: SETTINGS },
  screens: {
    list: ListScreen,
    errors: ErrorsScreen,
    notify: NotifyScreen,
    save: SaveScreen,
  },
}

function PartialImportList({ viewErrors }: { viewErrors?: ScreenProps }) {
  const sampleImport = useSampleImport()

  return (
    <ImportacoesPage>
      <ImportRow
        data={{
          ...sampleImport,
          status: 'partial',
          control: { kind: 'switch', enabled: true },
        }}
        hotspot={viewErrors && { ...viewErrors, target: 'errors' }}
      />
    </ImportacoesPage>
  )
}

function ListScreen(props: ScreenProps) {
  return <PartialImportList viewErrors={props} />
}

function ErrorsScreen({ action, onAdvance }: ScreenProps) {
  const { modal, errorRows } = useTutorialScreens('erros')
  const reprocessClass =
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium'

  return (
    <DialogOver background={<PartialImportList />}>
      <p className="text-base font-medium">{modal.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{modal.description}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {errorRows.map((item, index) => (
          <li
            key={item.row}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{modal.row(item.row)}</p>
              <p className="text-xs text-muted-foreground">{item.message}</p>
            </div>
            {index === 0 ? (
              <Hotspot
                action={action}
                onAdvance={onAdvance}
                className={reprocessClass}
              >
                <RotateCwIcon aria-hidden className="size-3.5" />
                {modal.reprocess}
              </Hotspot>
            ) : (
              <span className={reprocessClass}>
                <RotateCwIcon aria-hidden className="size-3.5" />
                {modal.reprocess}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2">
        <OutlineButton>{modal.close}</OutlineButton>
        <PrimaryButton>{modal.reprocessAll}</PrimaryButton>
      </div>
    </DialogOver>
  )
}

function NotifyScreen({ action, onAdvance }: ScreenProps) {
  const { users } = useTutorialScreens('erros')

  return (
    <ConfiguracoesPage>
      <GoogleCard connected />
      <NotifyCard
        users={users}
        selected={[]}
        dirty={false}
        userHotspot={{ action, onAdvance, user: users[0] }}
      />
    </ConfiguracoesPage>
  )
}

function SaveScreen(props: ScreenProps) {
  const { users } = useTutorialScreens('erros')

  return (
    <ConfiguracoesPage>
      <NotifyCard
        users={users}
        selected={[users[0]]}
        dirty
        saveHotspot={props}
      />
    </ConfiguracoesPage>
  )
}
