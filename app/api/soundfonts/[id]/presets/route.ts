import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { requireUserId, notFound, withApiHandler } from '@/lib/apiAuth';
import { SoundFontParser } from '@/engine/instruments/soundfont/SoundFontParser';
import { bundledPresets, localSoundfontPath } from '@/lib/localSoundfonts';

/**
 * The instruments a SoundFont contains.
 *
 * Three sources, in order of cost:
 *
 * 1. The build-time manifest, for fonts the deployment ships. No I/O and no
 *    parsing — and on a serverless host it is the *only* one that works, since
 *    the function has no `public/` directory to read.
 * 2. `public/soundfonts/` on disk, for fonts a developer has locally.
 * 3. Supabase, for admin uploads.
 *
 * Parsing is memoised because a General MIDI bank is tens of megabytes and its
 * preset list never changes — re-parsing on every request would make the
 * instrument picker unusably slow.
 */
export const dynamic = 'force-dynamic';

interface PresetSummary {
  index: number;
  name: string;
  bank: number;
  program: number;
}

const presetCache = new Map<string, PresetSummary[]>();

function extractPresets(buffer: ArrayBuffer): PresetSummary[] {
  const parsed = new SoundFontParser().parse(buffer);
  return parsed.presets.map((p, idx) => ({
    index: idx,
    name: p.name.trim(),
    bank: p.bank,
    program: p.preset,
  }));
}

/** Read a font served from `public/soundfonts/`. */
async function readLocalFont(id: string): Promise<ArrayBuffer | null> {
  const filePath = localSoundfontPath(id);
  if (!filePath) return null;

  try {
    const data = await fs.readFile(filePath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

/** Read a font uploaded to Supabase storage. */
async function readUploadedFont(storagePath: string): Promise<ArrayBuffer | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabaseAdmin = createClient(url, key);
  const { data, error } = await supabaseAdmin.storage.from('soundfonts').download(storagePath);
  if (error || !data) return null;

  return data.arrayBuffer();
}

export const GET = withApiHandler('soundfonts.presets', async (
  _req: Request,
  { params }: { params: { id: string } },
) => {
  await requireUserId();
  const { id } = params;

  // Shipped fonts were parsed at build time. This is the only branch that works
  // on a serverless host, where `public/` is not on the function's filesystem.
  const bundled = bundledPresets(id);
  if (bundled) return Response.json({ presets: bundled, cached: true });

  const cached = presetCache.get(id);
  if (cached) return Response.json({ presets: cached, cached: true });

  // Local fonts are identified by an id prefix, so no database lookup is needed.
  let buffer = await readLocalFont(id);

  if (!buffer) {
    const item = await prisma.soundFontLibraryItem.findUnique({ where: { id } });
    if (!item) throw notFound('SoundFont');

    buffer = await readUploadedFont(item.storagePath);
    if (!buffer) {
      return Response.json({ error: 'Could not read SoundFont file' }, { status: 502 });
    }
  }

  let presets: PresetSummary[];
  try {
    presets = extractPresets(buffer);
  } catch (error) {
    console.error(`[SoundFont] Failed to parse ${id}:`, error);
    return Response.json({ error: 'SoundFont could not be parsed' }, { status: 422 });
  }

  presetCache.set(id, presets);
  return Response.json({ presets, cached: false });
});
