import { Bot, Headset } from 'lucide-react'
import { HotspotButton, type ScreenProps } from './frame'

/**
 * Chat de um canal aberto do Bitrix24 (Contact Center), onde as conversas do
 * WhatsApp chegam. Lista de conversas à esquerda, conversa aberta à direita e a
 * caixa de resposta com o botão destacado.
 */

export type ChatMessage =
  | { from: 'in'; text: string; author?: string }
  | { from: 'out'; text: string }
  | { from: 'bot'; text: string }
  | { from: 'system'; text: string }

export function OpenChannelChat({
  chats,
  title,
  subtitle,
  messages,
  reply,
  action,
  onAdvance,
}: ScreenProps & {
  /** Conversas da lista; a primeira é a aberta. */
  chats: { name: string; detail: string }[]
  title: string
  subtitle: string
  messages: ChatMessage[]
  /** Texto já digitado na caixa de resposta. */
  reply: string
}) {
  return (
    <div className="grid h-full min-h-[inherit] gap-3 p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-6">
      <div className="hidden space-y-1 rounded-xl border border-border bg-background p-2 sm:block">
        {chats.map((chat, index) => (
          <div
            key={chat.name}
            className={`rounded-lg px-2 py-2 ${index === 0 ? 'bg-accent' : ''}`}
          >
            <p
              className={`truncate text-sm ${index === 0 ? 'font-semibold' : 'text-muted-foreground'}`}
            >
              {chat.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {chat.detail}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 py-2">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 py-4 text-sm">
          {messages.map((message, index) => (
            <Message key={index} message={message} />
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center">
          <p className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">
            {reply}
          </p>
          <HotspotButton
            action={action}
            onAdvance={onAdvance}
            className="self-end sm:self-auto"
          />
        </div>
      </div>
    </div>
  )
}

function Message({ message }: { message: ChatMessage }) {
  switch (message.from) {
    case 'in':
      return (
        <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
          {message.author && (
            <strong className="font-semibold">{message.author}: </strong>
          )}
          {message.text}
        </p>
      )
    case 'out':
      return (
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
          {message.text}
        </p>
      )
    case 'bot':
      return (
        <p className="ml-auto flex w-fit max-w-[85%] items-start gap-1.5 rounded-2xl rounded-tr-sm bg-sky-100 px-3 py-2 text-sky-950">
          <Bot aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="whitespace-pre-wrap">{message.text}</span>
        </p>
      )
    case 'system':
      return (
        <p className="inline-flex w-fit items-center gap-1 self-center rounded-full bg-foreground/5 px-3 py-1 text-[11px] text-muted-foreground">
          <Headset aria-hidden className="size-3" />
          {message.text}
        </p>
      )
  }
}
