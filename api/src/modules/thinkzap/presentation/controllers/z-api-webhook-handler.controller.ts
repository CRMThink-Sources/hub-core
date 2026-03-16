import { httpResponse } from "@/shared/helpers/http";
import type { EventRegistry } from "@/shared/infra/handlers/event-registry";
import type { ZApiEventHandler } from "@/shared/infra/handlers/z-api-event-handler";
import { Controller } from "@/shared/presentation/controller";
import { Request, Response } from "express";

export class ZApiWebhookHandlerController extends Controller {
  constructor(private readonly zApiEventRegistry: EventRegistry<ZApiEventHandler>) {
    super();
  }
  async perform(req: Request, res: Response): Promise<httpResponse> {
    const headers = req.headers;
    const data = req.body;

    const handler = this.zApiEventRegistry.get(data.type)

    if (!handler) {
      return this.notFound(new Error("Handler not found"));
    }
    await handler.handle(data);

    return this.ok({ message: "Webhook received" });
  }
}