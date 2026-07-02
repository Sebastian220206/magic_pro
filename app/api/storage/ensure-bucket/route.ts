import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = 'soundfonts';

async function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service role key not configured');
  }
  return createClient(url, serviceRoleKey);
}

export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = await getAdminClient();

    const { data: buckets } = await admin.storage.listBuckets();
    const exists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (exists) {
      return NextResponse.json({ bucket: STORAGE_BUCKET, created: false });
    }

    const { data, error } = await admin.storage.createBucket(STORAGE_BUCKET, {
      public: true,
    });

    if (error) {
      console.error('[ensure-bucket] createBucket error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bucket: data?.name ?? STORAGE_BUCKET, created: true });
  } catch (error: any) {
    console.error('[ensure-bucket] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to ensure bucket' }, { status: 500 });
  }
}
