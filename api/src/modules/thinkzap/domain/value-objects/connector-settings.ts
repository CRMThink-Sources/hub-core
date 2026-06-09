export type ConnectorSettings = {
  prefixOperatorNameEnabled: boolean
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
}

export const DEFAULT_CONNECTOR_SETTINGS: ConnectorSettings = {
  prefixOperatorNameEnabled: false,
  messageUpdateEventEnabled: true,
  messageDeleteEventEnabled: true,
}
