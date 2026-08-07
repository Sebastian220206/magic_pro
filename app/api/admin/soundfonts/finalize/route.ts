import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- AUTH GATE: Admin only ---
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { path, name, category, fileSizeKb } = await req.json();
  if (!path || !name || !category) {
    return Response.json({ error: 'Missing path, name, or category' }, { status: 400 });
  }

  const { data: pub } = supabaseAdmin.storage.from('soundfonts').getPublicUrl(path);

  const item = await prisma.soundFontLibraryItem.create({
    data: {
      name,
      category,
      fileUrl: pub.publicUrl,
      fileSizeKb: fileSizeKb ?? 0,
      storagePath: path,
    },
  });

  return Response.json(item);
}