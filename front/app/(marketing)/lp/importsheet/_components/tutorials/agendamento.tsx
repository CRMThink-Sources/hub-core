import { CircleCheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgendamentoScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import {
  ConfigureDialog,
  FakeInput,
  Field,
  ImportacoesPage,
  ImportRow,
  MappingTable,
  Switch,
  useSampleImport,
  type ImportRowData,
} from './shared/app-pages'
import {
  APP_PATH,
  FakeSelect,
  Hotspot,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

// Agendada não tem botão Executar: não há execução manual de importação agendada.
const APP: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}importacoes`,
  menu: 'importacoes',
}

export const AGENDAMENTO_VIEW: TutorialView<AgendamentoScreen> = {
  frames: {
    frequency: APP,
    hours: APP,
    scheduled: APP,
    'manual-run': APP,
    queued: APP,
  },
  screens: {
    frequency: FrequencyScreen,
    hours: HoursScreen,
    scheduled: ScheduledScreen,
    'manual-run': ManualRunScreen,
    queued: QueuedScreen,
  },
}

const SAMPLE_WEEKDAYS = [1, 3, 5]

function ScheduleSection({ hoursOption }: { hoursOption?: ScreenProps }) {
  const { shared } = useLpContent()
  const { everyHours } = useTutorialScreens('agendamento')
  const { schedule } = shared.configure
  const showDays = Boolean(hoursOption)

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-foreground">
        {schedule.title}
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={schedule.frequency}>
          <div className="relative">
            <FakeSelect
              value={
                showDays
                  ? schedule.frequencyOptions.days
                  : schedule.frequencyOptions.hours
              }
              className="w-full"
            />
            {hoursOption && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
                <Hotspot
                  {...hoursOption}
                  className="rounded-sm px-2 py-1.5 text-left text-sm"
                  dotClassName="right-2 top-2"
                >
                  {schedule.frequencyOptions.hours}
                </Hotspot>
                <span className="rounded-sm bg-accent px-2 py-1.5 text-sm">
                  {schedule.frequencyOptions.days}
                </span>
              </div>
            )}
          </div>
        </Field>
        {showDays ? (
          <Field label={schedule.weekdays}>
            <div className="flex flex-wrap gap-1">
              {schedule.weekdayLabels.map((label, day) => (
                <span
                  key={label}
                  className={cn(
                    'flex h-8 w-9 items-center justify-center rounded-md border text-xs font-medium',
                    SAMPLE_WEEKDAYS.includes(day)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </Field>
        ) : (
          <Field label={schedule.everyHours}>
            <FakeInput value={String(everyHours)} />
          </Field>
        )}
      </div>
      <span className="flex items-center gap-2">
        <Switch on={false} />
        <span className="text-sm text-foreground">{schedule.manual}</span>
      </span>
    </div>
  )
}

function FrequencyScreen(props: ScreenProps) {
  return (
    <ConfigureDialog>
      <ScheduleSection hoursOption={props} />
      <MappingTable identifierChecked />
    </ConfigureDialog>
  )
}

function HoursScreen(props: ScreenProps) {
  return (
    <ConfigureDialog save={props}>
      <ScheduleSection />
      <MappingTable identifierChecked />
    </ConfigureDialog>
  )
}

function useManualImport(running: boolean): ImportRowData {
  const { sample, configure, lista } = useLpContent().shared
  return {
    title: sample.manualImportTitle,
    entity: configure.entities.COMPANY,
    spreadsheet: sample.manualSpreadsheetName,
    schedule: lista.manual,
    status: running ? 'running' : undefined,
    control: { kind: 'run', running },
  }
}

function ScheduledScreen(props: ScreenProps) {
  const sampleImport = useSampleImport()

  return (
    <ImportacoesPage>
      <ImportRow
        data={{ ...sampleImport, control: { kind: 'switch', enabled: true } }}
        hotspot={{ ...props, target: 'switch' }}
      />
    </ImportacoesPage>
  )
}

function ManualRunScreen(props: ScreenProps) {
  const sampleImport = useSampleImport()
  const manualImport = useManualImport(false)

  return (
    <ImportacoesPage>
      <ImportRow
        data={{ ...sampleImport, control: { kind: 'switch', enabled: false } }}
      />
      <ImportRow data={manualImport} hotspot={{ ...props, target: 'run' }} />
    </ImportacoesPage>
  )
}

function QueuedScreen(props: ScreenProps) {
  const { queuedToast } = useTutorialScreens('agendamento')
  const sampleImport = useSampleImport()
  const manualImport = useManualImport(true)

  return (
    <div className="relative h-full min-h-[inherit] pb-16">
      <ImportacoesPage>
        <ImportRow
          data={{
            ...sampleImport,
            control: { kind: 'switch', enabled: false },
          }}
        />
        <ImportRow data={manualImport} hotspot={{ ...props, target: 'run' }} />
      </ImportacoesPage>
      <p
        role="status"
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm shadow-lg"
      >
        <CircleCheckIcon aria-hidden className="size-4 text-emerald-600" />
        {queuedToast}
      </p>
    </div>
  )
}
