export type CreateBiConnectorParams = {
  title: string
  logo: string
  description?: string
  urlCheck: string
  urlData: string
  urlTableList: string
  urlTableDescription: string
  settings: {
    code: string
    name: string
    type: string
  }[]
}

export type BiconnectorResult = {
  id: number
  title?: string
  urlCheck?: string
  urlData?: string
  urlTableList?: string
  urlTableDescription?: string
}

export type SourceSettings = Record<string, string>

export type CreateSourceParams = {
  connectorId: number
  title: string
  active?: boolean
  settings: SourceSettings
}

export type SourceResult = {
  id: number
  connectorId: number
  title: string
  active: boolean
  settings: SourceSettings
}
