export type ConnectorSettings = {
  prefixOperatorNameEnabled: boolean
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
  widgetOpenChannelEnabled: boolean
}

export const DEFAULT_CONNECTOR_SETTINGS: ConnectorSettings = {
  prefixOperatorNameEnabled: false,
  messageUpdateEventEnabled: true,
  messageDeleteEventEnabled: true,
  widgetOpenChannelEnabled: false,
}
