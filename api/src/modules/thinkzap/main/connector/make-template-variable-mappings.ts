import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Request } from 'express'
import { GetTemplateVariableMappingUseCase } from '../../application/get-template-variable-mapping'
import { ListCrmEntityTypesUseCase } from '../../application/list-crm-entity-types'
import { ListCrmFieldsUseCase } from '../../application/list-crm-fields'
import { ResolveTemplateVariableValuesUseCase } from '../../application/resolve-template-variable-values'
import { SetTemplateVariableMappingUseCase } from '../../application/set-template-variable-mapping'
import { PrismaTemplateVariableMappingsRepository } from '../../infra/persistence/repositories/prisma-template-variable-mappings.repository'
import {
  ListCrmEntityTypesController,
  ListCrmFieldsController,
} from '../../presentation/controllers/connector/list-crm-fields.controller'
import {
  GetTemplateVariableMappingController,
  SetTemplateVariableMappingController,
} from '../../presentation/controllers/connector/template-variable-mapping.controller'
import { TemplateVariableValuesController } from '../../presentation/controllers/template-variable-values.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'

export const makeListCrmFieldsController = async (
  req: Request,
): Promise<Controller> =>
  new ListCrmFieldsController(
    new ListCrmFieldsUseCase(await makeBitrixClient(req)),
  )

export const makeGetTemplateVariableMappingController = (
  _req: Request,
): Promise<Controller> =>
  Promise.resolve(
    new GetTemplateVariableMappingController(
      new GetTemplateVariableMappingUseCase(
        new PrismaTemplateVariableMappingsRepository(),
      ),
    ),
  )

export const makeSetTemplateVariableMappingController = (
  _req: Request,
): Promise<Controller> =>
  Promise.resolve(
    new SetTemplateVariableMappingController(
      new SetTemplateVariableMappingUseCase(
        makeGetAplicationContext(),
        makeTemplateProviderResolver(),
        new PrismaTemplateVariableMappingsRepository(),
      ),
    ),
  )

export const makeTemplateVariableValuesController = async (
  req: Request,
): Promise<Controller> =>
  new TemplateVariableValuesController(
    new ResolveTemplateVariableValuesUseCase(
      await makeBitrixClient(req),
      new PrismaTemplateVariableMappingsRepository(),
    ),
  )

export const makeListCrmEntityTypesController = async (
  req: Request,
): Promise<Controller> =>
  new ListCrmEntityTypesController(
    new ListCrmEntityTypesUseCase(await makeBitrixClient(req)),
  )
