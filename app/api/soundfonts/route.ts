import { prisma } from '@/lib/prisma';
import { requireUserId, withApiHandler } from '@/lib/apiAuth';
import { listLocalSoundfonts } from '@/lib/localSoundfonts';

/**
 * The SoundFont library.
 *
 * Merges two sources: fonts uploaded to Supabase by an admin (recorded as
 * `SoundFontLibraryItem` rows) and fonts served from `public/soundfonts/`.
 *
 * Local fonts were previously invisible — this endpoint only read the database,
 * so a `.sf2` sitting on disk could never be selected. Including them is what
 * makes a bundled General MIDI bank work with no upload and no seed step.
 */
export const dynamic = 'force-dynamic';

export const GET = withApiHandler('soundfonts.list', async () => {
  await requireUserId();

  const [uploaded, local] = await Promise.all([
    prisma.soundFontLibraryItem.findMany({ orderBy: { createdAt: 'desc' } }),
    listLocalSoundfonts(),
  ]);

  // Local fonts first, with any General MIDI bank at the very top — it covers
  // piano, brass, bass and strings in one file, so it is the sensible default.
  return Response.json([
    ...local,
    ...uploaded.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      fileUrl: item.fileUrl,
      fileSizeKb: item.fileSizeKb,
      storagePath: item.storagePath,
      isGeneralMidi: false,
    })),
  ]);
});
