import { Request } from 'express'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ListButtonLinesUseCase } from '../application/list-button-lines'
import { ButtonLinesController } from '../presentation/controllers/button-lines.controller'

export const makeListButtonOfficialLinesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new ListButtonLinesUseCase(
    makeGetAplicationContext(),
    ConnectorProvider.HUBMESSAGE,
  )

  return Promise.resolve(new ButtonLinesController(useCase))
}

export const makeListButtonUnofficialLinesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new ListButtonLinesUseCase(
    makeGetAplicationContext(),
    ConnectorProvider.ZAPI,
  )

  return Promise.resolve(new ButtonLinesController(useCase))
}
