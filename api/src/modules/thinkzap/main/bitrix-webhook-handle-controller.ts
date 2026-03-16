import { Controller } from "@/shared/presentation/controller";
import { Request } from "express";
import { EventRegistry } from "@/shared/infra/handlers/event-registry";
import type { BitrixEventHandler } from "@/shared/infra/handlers/bitrix-event-handler";
import { BitrixReceivedMessageHandler } from "@/shared/infra/handlers/bitrix/bitrix-received-message.handler";
import { BitrixWebhookHandlerController } from "../presentation/controllers/bitrix-webhook-handler.controller";
import { PrismaBitrixWebhookContextRepository } from "../infra/persistence/repositories/prisma-bitrix-webhook-context.repository";

export const makeBitrixWebhookHandlerController = async (req: Request): Promise<Controller> => {
  const bitrixWebhookContextRepo = new PrismaBitrixWebhookContextRepository();
  const bitrixEventRegistry = new EventRegistry<BitrixEventHandler>();

  bitrixEventRegistry.register(new BitrixReceivedMessageHandler(bitrixWebhookContextRepo));

  return new BitrixWebhookHandlerController(bitrixEventRegistry);
};