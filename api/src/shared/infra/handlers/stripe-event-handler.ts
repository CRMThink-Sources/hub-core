import type Stripe from 'stripe'
import type { EventHandler } from './event-registry'

export type StripeEventHandler = EventHandler<Stripe.Event>
