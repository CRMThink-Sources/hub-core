import { Controller } from "@/shared/presentation/controller";
import { CreateConnectorController } from "../presentation/controllers/create-connector.controller";

export const makeCreateConnectorController = (): Controller => {
  return new CreateConnectorController();
}
