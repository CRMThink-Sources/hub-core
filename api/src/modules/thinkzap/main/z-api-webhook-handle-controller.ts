import { Controller } from "@/shared/presentation/controller";
import { ZApiWebhookHandlerController } from "../presentation/controllers/z-api-webhook-handler.controller";
import { EventRegistry } from "@/shared/infra/handlers/event-registry";
import type { ZApiEventHandler } from "@/shared/infra/handlers/z-api-event-handler";
import { ReceivedMessageHandler } from "@/shared/infra/handlers/z-api/received-message.handler";
import { Request } from "express";

export const makeZApiWebhookHandlerController = async (req: Request): Promise<Controller> => {
  const zApiEventRegistry = new EventRegistry<ZApiEventHandler>();

  zApiEventRegistry.register(new ReceivedMessageHandler());

  return new ZApiWebhookHandlerController(zApiEventRegistry);
};