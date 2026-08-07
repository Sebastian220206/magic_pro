# SoundFont Library Upload — Signed URL Variant

Direct-to-Supabase upload from the browser. File bytes never pass through a
Vercel function, so there's no 4MB body-size ceiling to worry about for large
`.sf2` files.

## How it differs from the simple version

**Simple version (previous):** browser → Vercel API route → Supabase.
The whole file passes through your Next.js function, capped by Vercel's body
size limit.

**Signed URL version (this doc):** browser → Supabase directly, using a
short-lived signed upload token. Your API routes only ever handle tiny JSON
payloads (a filename, then some metadata) — never the file itself.

Three pieces:
1. A tiny API route that mints a signed upload URL (no file bytes touch it)
2. The browser uploads the file straight to Supabase Storage using that URL
3. A second tiny API route writes the DB row once the upload succeeds

---

## 0. Environment variables

```
# server-only (never exposed to client)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# client-safe (used by the browser to talk to Supabase Storage directly)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The anon key is safe to expose — it can't write to the `soundfonts` bucket
without a valid signed token, which only your server can mint.

---

## 1. Prisma model (unchanged from earlier)

```prisma
model SoundFontLibraryItem {
  id           String   @id @default(cuid())
  name         String
  category     String
  fileUrl      String
  fileSizeKb   Int
  createdAt    DateTime @default(now())
}
```

---

## 2. Client-side Supabase instance

```ts
// lib/supabaseBrowserClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 3. Backend — route that mints the signed upload URL

```ts
// app/api/admin/soundfonts/signed-upload/route.ts
import { createClient } from '@supabase/supabase-js';
// import your auth helper here, e.g. getServerSession
// import { authOptions } from '@/lib/auth';
// import { getServerSession } from 'next-auth';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // --- AUTH GATE: uncomment and wire to your real auth check ---
  // const session = await getServerSession(authOptions);
  // if (session?.user?.role !== 'admin') {
  //   return Response.json({ error: 'Unauthorized' }, { status: 403 });
  // }

  const { fileName } = await req.json();
  if (!fileName || !fileName.endsWith('.sf2')) {
    return Response.json({ error: 'fileName must end in .sf2' }, { status: 400 });
  }

  const path = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

  const { data, error } = await supabaseAdmin.storage
    .from('soundfonts')
    .createSignedUploadUrl(path);

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Could not create signed URL' }, { status: 500 });
  }

  return Response.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  });
}
```

---

## 4. Backend — route that finalizes the DB row after upload succeeds

```ts
// app/api/admin/soundfonts/finalize/route.ts
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // --- AUTH GATE: same check as signed-upload route ---

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
    },
  });

  return Response.json(item);
}
```

---

## 5. Frontend — upload form using the signed URL

```tsx
// components/admin/SoundFontUploadForm.tsx
'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowserClient';

export function SoundFontUploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Piano');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progressLabel, setProgressLabel] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setStatus('uploading');
    setErrorMsg('');

    try {
      // Step 1: get a signed upload URL from our server (tiny JSON call)
      setProgressLabel('Requesting upload slot…');
      const signedRes = await fetch('/api/admin/soundfonts/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });
      const signedData = await signedRes.json();
      if (!signedRes.ok) throw new Error(signedData.error || 'Could not get upload URL');

      const { path, token } = signedData;

      // Step 2: upload the file directly to Supabase Storage (bypasses Vercel entirely)
      setProgressLabel('Uploading file…');
      const { error: uploadError } = await supabaseBrowser.storage
        .from('soundfonts')
        .uploadToSignedUrl(path, token, file);

      if (uploadError) throw new Error(uploadError.message);

      // Step 3: finalize — write the DB row (tiny JSON call, no file bytes)
      setProgressLabel('Saving to library…');
      const finalizeRes = await fetch('/api/admin/soundfonts/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          name,
          category,
          fileSizeKb: Math.round(file.size / 1024),
        }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error || 'Could not save to library');

      setStatus('success');
      setFile(null);
      setName('');
      setProgressLabel('');
      onUploaded?.();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setProgressLabel('');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
      <label>
        SF2 File
        <input
          type="file"
          accept=".sf2"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </label>

      <label>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Upright Piano"
          required
        />
      </label>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>Piano</option>
          <option>Strings</option>
          <option>Bass</option>
          <option>Brass</option>
          <option>Synth</option>
          <option>Other</option>
        </select>
      </label>

      <button type="submit" disabled={status === 'uploading' || !file || !name}>
        {status === 'uploading' ? (progressLabel || 'Uploading…') : 'Upload to Library'}
      </button>

      {status === 'success' && <p style={{ color: 'green' }}>Uploaded successfully.</p>}
      {status === 'error' && <p style={{ color: 'red' }}>{errorMsg}</p>}
    </form>
  );
}
```

---

## 6. Admin page (gated route)

```tsx
// app/admin/soundfonts/page.tsx
import { SoundFontUploadForm } from '@/components/admin/SoundFontUploadForm';
// import your auth check here — e.g. getServerSession + role check, redirect if not admin

export default async function AdminSoundFontsPage() {
  // const session = await getServerSession();
  // if (session?.user?.role !== 'admin') redirect('/');

  return (
    <div style={{ padding: 24 }}>
      <h1>Upload SoundFont to Library</h1>
      <SoundFontUploadForm />
    </div>
  );
}
```

---

## Things to wire in before shipping

1. **Auth gate on both API routes.** Both `signed-upload` and `finalize` have
   commented-out placeholders — plug in your real NextAuth session + role
   check. Without it, anyone who finds the route can mint upload tokens or
   write arbitrary DB rows.

2. **Supabase Storage bucket policy.** The signed upload token itself is the
   security boundary here — you don't need public *write* access on the
   bucket, only public *read* (for playback via `fileUrl`). Confirm bucket
   policy allows public read, not public write.

3. **Client bundle size.** This introduces `@supabase/supabase-js` as a
   client-side dependency (not just server-side). Check it doesn't
   meaningfully bloat your JS bundle given the accessibility/low-end-device
   target — it should be small, but worth confirming with your bundle
   analyzer since every KB matters for your target users.

4. **Signed URL expiry.** `createSignedUploadUrl` tokens expire (default is
   short-lived, typically ~2 hours in Supabase). Fine for an admin clicking
   through a form, but if you ever batch-script this, the flow above is for
   the UI path only — the CLI script from earlier can keep using the service
   role key directly since it's a trusted server context, not a browser.
