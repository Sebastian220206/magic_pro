import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminId, withApiHandler } from '@/lib/apiAuth';

const STORAGE_BUCKET = 'soundfonts';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service role key not configured');
  }
  return createClient(url, serviceRoleKey);
}

/**
 * Provision the public soundfont bucket.
 *
 * Admin-only: this runs with the Supabase service-role key and creates a
 * publicly readable bucket, so it must not be reachable by ordinary users.
 */
export const POST = withApiHandler('storage.ensureBucket', async (_request: NextRequest) => {
  await requireAdminId();

  const admin = getAdminClient();

  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some(b => b.name === STORAGE_BUCKET)) {
    return NextResponse.json({ bucket: STORAGE_BUCKET, created: false });
  }

  const { data, error } = await admin.storage.createBucket(STORAGE_BUCKET, { public: true });

  if (error) {
    console.error('[storage.ensureBucket] createBucket failed:', error);
    return NextResponse.json({ error: 'Failed to create storage bucket' }, { status: 502 });
  }

  return NextResponse.json({ bucket: data?.name ?? STORAGE_BUCKET, created: true });
});
