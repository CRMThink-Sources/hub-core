export type BiconnectorSetting = {
  code: string
  name: string
  type: string
}

export type CreateBiConnectorParams = {
  title: string
  urlCheck: string
  urlData: string
  urlTableList: string
  urlTableDescription: string
  settings: BiconnectorSetting[]
}

export type BiconnectorAddResult = {
  ID: number
}

export type BiconnectorItem = {
  ID: number
  TITLE: string
  DATE_CREATE: string
  URL_CHECK: string
  URL_DATA: string
  URL_TABLE_LIST: string
  URL_TABLE_DESCRIPTION: string
  SETTINGS: BiconnectorSetting[]
}
