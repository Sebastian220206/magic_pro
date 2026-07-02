import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Create soundfonts storage bucket
  console.log('Creating soundfonts bucket...')
  try {
    await prisma.$executeRaw`
      INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
      VALUES ('soundfonts', 'soundfonts', true, false, 52428800, NULL)
      ON CONFLICT (id) DO NOTHING
    `
    console.log('✓ Bucket created/confirmed')
  } catch (e: any) {
    console.log('Cannot create bucket:', e.message)
  }

  // 2. Check storage RLS policies
  console.log('\nChecking storage RLS policies...')
  try {
    const policies: any[] = await prisma.$queryRaw`
      SELECT pol.polname, pol.polpermissive, pol.polroles, 
             CASE WHEN pol.polcmd = '*' THEN 'ALL' ELSE pol.polcmd END as cmd
      FROM pg_policy pol
      JOIN pg_class cls ON cls.oid = pol.polrelid
      WHERE cls.relname = 'objects' AND cls.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage')
    `
    console.log('Policies on storage.objects:', policies.length)
    for (const p of policies) {
      console.log(`  - ${p.polname}: cmd=${p.cmd}, roles=${p.polroles}`)
    }

    if (policies.length === 0) {
      console.log('\nNo policies found. Creating policies for anon key access...')
      
      // Allow anon to upload to soundfonts bucket
      await prisma.$executeRaw`
        CREATE POLICY "anon_upload_soundfonts" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'soundfonts'
        )
      `
      console.log('✓ Created anon_upload_soundfonts policy')

      // Allow anon to select from any bucket
      await prisma.$executeRaw`
        CREATE POLICY "anon_select_objects" ON storage.objects
        FOR SELECT USING (true)
      `
      console.log('✓ Created anon_select_objects policy')

      // Allow anon to delete their own uploads
      await prisma.$executeRaw`
        CREATE POLICY "anon_delete_soundfonts" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'soundfonts'
        )
      `
      console.log('✓ Created anon_delete_soundfonts policy')
    }
  } catch (e: any) {
    console.log('Cannot manage storage policies:', e.message)
  }

  // 3. Verify everything
  console.log('\nVerifying...')
  const buckets: any[] = await prisma.$queryRaw`SELECT id, name, public FROM storage.buckets ORDER BY name`
  console.log('Buckets:', buckets.map((b: any) => `${b.name} (public=${b.public})`))

  console.log('\n✓ Setup complete!')
}

main().catch(e => console.error('Error:', e.message)).finally(() => prisma.$disconnect())
