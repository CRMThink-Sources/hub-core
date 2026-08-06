import { Controller } from '@/shared/presentation/controller'
import { ActivateConnectorTrial } from '@/modules/thinkzap/application/activate-connector-trial'
import { GetConnectorTrialState } from '@/modules/thinkzap/application/get-connector-trial-state'
import { ActivateTrialController } from '@/modules/thinkzap/presentation/controllers/trial/activate-trial.controller'
import { GetTrialStateController } from '@/modules/thinkzap/presentation/controllers/trial/get-trial-state.controller'
import { makeTrialDeps } from './make-trial-deps'

export const makeGetTrialStateController = (): Controller => {
  const { getAplicationContext, plans } = makeTrialDeps()

  return new GetTrialStateController(
    new GetConnectorTrialState(getAplicationContext, plans),
  )
}

export const makeActivateTrialController = (): Controller => {
  const {
    getAplicationContext,
    plans,
    subscriptions,
    items,
    providerResolver,
  } = makeTrialDeps()

  return new ActivateTrialController(
    new ActivateConnectorTrial(
      getAplicationContext,
      plans,
      subscriptions,
      items,
      providerResolver,
    ),
  )
}
