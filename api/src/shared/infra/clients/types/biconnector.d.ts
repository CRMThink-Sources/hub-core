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
