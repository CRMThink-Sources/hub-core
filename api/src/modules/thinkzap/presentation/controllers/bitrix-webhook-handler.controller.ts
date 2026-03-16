import { httpResponse } from "@/shared/helpers/http";
import type { EventRegistry } from "@/shared/infra/handlers/event-registry";
import type { BitrixEventHandler } from "@/shared/infra/handlers/bitrix-event-handler";
import { Controller } from "@/shared/presentation/controller";
import { Request, Response } from "express";

export class BitrixWebhookHandlerController extends Controller {
  constructor(private readonly bitrixEventRegistry: EventRegistry<BitrixEventHandler>) {
    super();
  }
  async perform(req: Request, res: Response): Promise<httpResponse> {
    const headers = req.headers;
    const data = req.body;

    const handler = this.bitrixEventRegistry.get(data.event)

    if (!handler) {
      return this.notFound(new Error("Handler not found"));
    }
    await handler.handle(data);

    return this.ok({ message: "Webhook received" });
  }
}