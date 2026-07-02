import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe, PLANS, PlanTier } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { planTier, returnUrl } = body;

    if (!planTier || !PLANS[planTier as PlanTier]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const plan = PLANS[planTier as PlanTier];

    if (!plan.priceId) {
      return NextResponse.json({ error: 'Plan has no associated price' }, { status: 400 });
    }

    const checkout = await stripe.checkout.sessions.create({
      customer_email: session.user.email || undefined,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${returnUrl || request.headers.get('origin') || 'http://localhost:3000'}/settings?checkout=success`,
      cancel_url: `${returnUrl || request.headers.get('origin') || 'http://localhost:3000'}/settings?checkout=cancelled`,
      metadata: { userId: session.user.id, planTier },
      subscription_data: { metadata: { userId: session.user.id, planTier } },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json({ error: error.message || 'Checkout failed' }, { status: 500 });
  }
}
