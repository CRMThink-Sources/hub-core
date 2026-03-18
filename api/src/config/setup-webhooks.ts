// import { Stripe } from 'stripe'
// import { env } from './env'

// const stripe = new Stripe(env.stripe.secretKey)

// stripe.webhookEndpoints.create({
//   enabled_events: [
//     'checkout.session.completed',
//     'customer.subscription.created',
//     'customer.subscription.updated',
//     'customer.subscription.deleted',
//     'invoice.payment_failed',
//   ],
//   url: `${env.apiUrl}/api/webhooks/stripe`,
// })
