import { env } from "@/config/env";
import { httpResponse } from "@/shared/helpers/http";
import type { EventRegistry } from "@/shared/infra/handlers/event-registry";
import type { StripeEventHandler } from "@/shared/infra/handlers/stripe-event-handler";
import { Controller } from "@/shared/presentation/controller";
import { Request, Response } from "express";
import Stripe from "stripe";

export class StripeWebhookHandlerController extends Controller {
  constructor(
    private readonly stripeEventRegistry: EventRegistry<StripeEventHandler>
  ) {
    super();
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const stripe = new Stripe(env.stripe.secretKey);
    const sig = req.headers["stripe-signature"];

    if (!sig) return this.badRequest(new Error("Missing stripe-signature header"));

    const event = stripe.webhooks.constructEvent(req.body, sig, env.stripe.webhookSecret);

    const handler = this.stripeEventRegistry.get(event.type);

    if (!handler) {
      return this.ok({ received: true });
    }

    await handler.handle(event);

    return this.ok({ received: true });
  }
}
