'use client'

import { useTranslation } from 'react-i18next'
import { AdminClientConnectorSection } from './admin-client-connector-section'
import { AdminClientImbotSection } from './admin-client-imbot-section'
import { AdminClientButtonImbotSection } from './admin-client-button-imbot-section'
import { AdminClientConversationWidgetSection } from './admin-client-conversation-widget-section'
import { AdminClientSpaWidgetSection } from './admin-client-spa-widget-section'
import { AdminClientBizprocRobotSection } from './admin-client-bizproc-robot-section'

type Props = {
  appId: string
}

export function AdminClientDeploymentSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-foreground">
          {t('deploymentTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('deploymentDescription')}
        </p>
      </div>

      <AdminClientConnectorSection appId={appId} />
      <AdminClientImbotSection appId={appId} />
      <AdminClientButtonImbotSection appId={appId} />
      <AdminClientConversationWidgetSection appId={appId} />
      <AdminClientSpaWidgetSection appId={appId} />
      <AdminClientBizprocRobotSection appId={appId} />
    </div>
  )
}
