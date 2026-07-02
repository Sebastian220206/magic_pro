import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;

let stripeInstance: Stripe | null = null;

if (stripeKey) {
  stripeInstance = new Stripe(stripeKey);
}

export const stripe = stripeInstance;

export const PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    limits: {
      projects: 5,
      storage: 100 * 1024 * 1024,
      tracks: 8,
      exportFormats: ['wav'],
    },
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    limits: {
      projects: 100,
      storage: 10 * 1024 * 1024 * 1024,
      tracks: 128,
      exportFormats: ['wav', 'mp3', 'flac', 'ogg', 'aiff'],
    },
  },
  studio: {
    name: 'Studio',
    priceId: process.env.STRIPE_STUDIO_PRICE_ID || 'price_studio',
    limits: {
      projects: -1,
      storage: 100 * 1024 * 1024 * 1024,
      tracks: 512,
      exportFormats: ['wav', 'mp3', 'flac', 'ogg', 'aiff', 'caf'],
    },
  },
} as const;

export type PlanTier = keyof typeof PLANS;

export function getPlanLimits(tier: PlanTier) {
  return PLANS[tier].limits;
}
