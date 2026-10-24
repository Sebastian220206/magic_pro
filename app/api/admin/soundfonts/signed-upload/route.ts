import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';
  return createClient(url, key);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- AUTH GATE: Admin only ---
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fileName } = await req.json();
  if (!fileName || !fileName.endsWith('.sf2')) {
    return Response.json({ error: 'fileName must end in .sf2' }, { status: 400 });
  }

  const path = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from('soundfonts')
    .createSignedUploadUrl(path);

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Could not create signed URL' }, { status: 500 });
  }

  return Response.json({
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  });
}