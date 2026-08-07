import { SoundFontUploadForm } from '@/components/admin/SoundFontUploadForm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminSoundFontsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') redirect('/');

  return (
    <div style={{ padding: 24 }}>
      <h1>Upload SoundFont to Library</h1>
      <SoundFontUploadForm />
    </div>
  );
}