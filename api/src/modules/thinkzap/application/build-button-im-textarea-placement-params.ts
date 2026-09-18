import { env } from '@/config/env'

export type ButtonImTextareaPlacementOptions = {
  iconName: string
  context: string
  role: string
  extranet: string
  color: string
  width: string
  height: string
}

export type ButtonImTextareaPlacementBindParams = {
  PLACEMENT: 'IM_TEXTAREA'
  HANDLER: string
  TITLE: string
  LANG_ALL: Record<string, { TITLE: string }>
  OPTIONS: ButtonImTextareaPlacementOptions
}

export function buildButtonImTextareaPlacementBindParams(): ButtonImTextareaPlacementBindParams {
  const title = env.bitrix.iframeButton.name
  const handler = env.bitrix.iframeButton.url

  return {
    PLACEMENT: 'IM_TEXTAREA',
    HANDLER: handler,
    TITLE: title,
    LANG_ALL: {
      pt: { TITLE: title },
      en: { TITLE: title },
      es: { TITLE: title },
      ru: { TITLE: title },
    },
    OPTIONS: {
      iconName: 'fa-list',
      context: 'LINES',
      role: 'USER',
      extranet: 'N',
      color: 'GREEN',
      width: '400',
      height: '480',
    },
  }
}
