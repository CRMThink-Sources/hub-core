export type CreateBiConnectorParams = {
  title: string
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
  ID: number
}
