import { FileSignature, FileText, Info, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  AcompanhamentoScreen,
  DealFieldId,
  SignerStatus,
} from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import { CrmDealPage, DEAL_ID } from './shared/crm'
import {
  Hotspot,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

const DEAL: ScreenFrame = {
  kind: 'bitrix',
  path: `crm/deal/details/${DEAL_ID}/`,
  menu: 'crm',
}

export const ACOMPANHAMENTO_VIEW: TutorialView<AcompanhamentoScreen> = {
  frames: {
    sent: DEAL,
    signed: DEAL,
    finished: DEAL,
    refused: DEAL,
    cancel: DEAL,
    canceled: DEAL,
    error: DEAL,
  },
  screens: {
    sent: SentScreen,
    signed: SignedScreen,
    finished: FinishedScreen,
    refused: RefusedScreen,
    cancel: CancelScreen,
    canceled: CanceledScreen,
    error: ErrorScreen,
  },
}

type CardStatus = 'progress' | 'finished' | 'refused' | 'canceled'

const TAG: Record<CardStatus, string> = {
  progress: 'bg-amber-100 text-amber-800',
  finished: 'bg-emerald-100 text-emerald-800',
  refused: 'bg-red-100 text-red-700',
  canceled: 'bg-red-100 text-red-700',
}

type CardHotspot = ScreenProps & {
  target: 'tag' | 'cancel' | { signer: number }
}

function ActivityCard({
  status,
  signers,
  hotspot,
}: {
  status: CardStatus
  signers: SignerStatus[]
  hotspot?: CardHotspot
}) {
  const { card, sample } = useLpContent().shared
  const props = hotspot && {
    action: hotspot.action,
    onAdvance: hotspot.onAdvance,
  }
  const tagHotspot = hotspot?.target === 'tag' ? props : undefined
  const cancelHotspot = hotspot?.target === 'cancel' ? props : undefined
  const signerIndex =
    typeof hotspot?.target === 'object' ? hotspot.target.signer : -1

  if (status === 'canceled') {
    return (
      <TimelineItem icon={FileText}>
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#333]">
            {card.canceledHeader(sample.documentId)}
          </span>
          <Tag status="canceled" />
        </p>
      </TimelineItem>
    )
  }

  return (
    <TimelineItem icon={FileSignature}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#333]">
          {card.header(sample.documentId, sample.groupId)}
        </span>
        {tagHotspot ? (
          <Hotspot {...tagHotspot} className="rounded-full">
            <Tag status={status} />
          </Hotspot>
        ) : (
          <Tag status={status} />
        )}
      </p>
      <p className="mt-2 font-semibold text-[#535c69]">{card.title}</p>
      <p className="text-[#535c69]">{card.intro}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {sample.signers.map((signer, index) => {
          const line = `${signer.name} - ${signer.email} - ${card.signer[signers[index]]}`
          return (
            <li key={signer.email} className="min-w-0">
              {index === signerIndex && props ? (
                <Hotspot
                  {...props}
                  className="max-w-full truncate rounded px-1"
                >
                  {line}
                </Hotspot>
              ) : (
                <span className="block truncate text-[#828b95]">{line}</span>
              )}
            </li>
          )
        })}
      </ul>
      {status === 'progress' && (
        <div className="mt-3">
          {cancelHotspot ? (
            <Hotspot
              {...cancelHotspot}
              className="inline-flex h-7 items-center rounded-full border border-[#c6cdd3] px-3 font-medium text-[#535c69]"
            >
              {card.cancel}
            </Hotspot>
          ) : (
            <span className="inline-flex h-7 items-center rounded-full border border-[#c6cdd3] px-3 font-medium text-[#535c69]">
              {card.cancel}
            </span>
          )}
        </div>
      )}
    </TimelineItem>
  )
}

function Tag({ status }: { status: CardStatus }) {
  const { card } = useLpContent().shared
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
        TAG[status],
      )}
    >
      {card.status[status]}
    </span>
  )
}

function TimelineItem({
  icon: Icon,
  children,
}: {
  icon: typeof FileText
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2 rounded-lg bg-white p-3 text-xs">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2fc6f6]/15 text-[#2067b0]">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function LogMessage({
  title,
  lines,
  hotspot,
}: {
  title: string
  lines: string[]
  hotspot?: ScreenProps
}) {
  return (
    <TimelineItem icon={Info}>
      {hotspot ? (
        <Hotspot
          {...hotspot}
          className="rounded px-1 text-left font-semibold text-[#333]"
        >
          {title}
        </Hotspot>
      ) : (
        <p className="font-semibold text-[#333]">{title}</p>
      )}
      {lines.map(line => (
        <p key={line} className="mt-0.5 text-[#535c69]">
          {line}
        </p>
      ))}
    </TimelineItem>
  )
}

function SentScreen({ action, onAdvance }: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <CrmDealPage
      fields={{ arquivo: sample.fileName, documentoId: sample.documentId }}
    >
      <ActivityCard
        status="progress"
        signers={['waiting', 'waiting']}
        hotspot={{ action, onAdvance, target: 'tag' }}
      />
    </CrmDealPage>
  )
}

function SignedScreen({ action, onAdvance }: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <CrmDealPage
      fields={{ arquivo: sample.fileName, documentoId: sample.documentId }}
    >
      <ActivityCard
        status="progress"
        signers={['signed', 'waiting']}
        hotspot={{ action, onAdvance, target: { signer: 0 } }}
      />
    </CrmDealPage>
  )
}

function FinishedScreen({ action, onAdvance }: ScreenProps) {
  const { sample } = useLpContent().shared
  const fields: Partial<Record<DealFieldId, string>> = {
    arquivo: sample.fileName,
    documentoId: sample.documentId,
    status: sample.yes,
    finalizado: sample.yes,
    dataAssinatura: sample.signedAt,
  }
  return (
    <CrmDealPage
      fields={fields}
      highlight={{
        field: 'arquivoAssinado',
        node: (
          <Hotspot
            action={action}
            onAdvance={onAdvance}
            className="max-w-full truncate rounded px-1 text-left text-[#2067b0] underline"
          >
            {sample.signedFileName}
          </Hotspot>
        ),
      }}
    >
      <ActivityCard status="finished" signers={['signed', 'signed']} />
    </CrmDealPage>
  )
}

function RefusedScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  const { refusedLog, when } = useTutorialScreens('acompanhamento')
  const refuser = sample.signers[1].name
  return (
    <CrmDealPage
      fields={{ arquivo: sample.fileName, documentoId: sample.documentId }}
    >
      <LogMessage
        title={refusedLog.title}
        lines={[
          refusedLog.by(refuser, when),
          refusedLog.reasons,
          refusedLog.comment,
        ]}
        hotspot={props}
      />
      <ActivityCard status="refused" signers={['signed', 'refused']} />
    </CrmDealPage>
  )
}

function CancelScreen({ action, onAdvance }: ScreenProps) {
  const { sample } = useLpContent().shared
  return (
    <CrmDealPage
      fields={{ arquivo: sample.fileName, documentoId: sample.documentId }}
    >
      <ActivityCard
        status="progress"
        signers={['waiting', 'waiting']}
        hotspot={{ action, onAdvance, target: 'cancel' }}
      />
    </CrmDealPage>
  )
}

function CanceledScreen(props: ScreenProps) {
  const { sample } = useLpContent().shared
  const { canceledLog, when } = useTutorialScreens('acompanhamento')
  return (
    <CrmDealPage
      fields={{ arquivo: sample.fileName, documentoId: sample.documentId }}
    >
      <LogMessage
        title={canceledLog.title}
        lines={[canceledLog.by(sample.user, when)]}
        hotspot={props}
      />
      <ActivityCard status="canceled" signers={[]} />
    </CrmDealPage>
  )
}

function ErrorScreen({ action, onAdvance }: ScreenProps) {
  const { errorComment } = useTutorialScreens('acompanhamento')
  return (
    <CrmDealPage>
      <TimelineItem icon={MessageSquare}>
        <Hotspot
          action={action}
          onAdvance={onAdvance}
          className="rounded px-1 text-left text-[#333]"
        >
          {errorComment}
        </Hotspot>
      </TimelineItem>
    </CrmDealPage>
  )
}
