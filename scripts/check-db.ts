import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const tables: any[] = await prisma.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename='Soundfont'`
  console.log('Soundfont table exists:', tables.length > 0)
  try {
    const buckets: any[] = await prisma.$queryRaw`SELECT id, name FROM storage.buckets`
    console.log('Storage buckets:', JSON.stringify(buckets.map((b: any) => b.name)))
  } catch (e: any) {
    console.log('storage.buckets not accessible:', e.message)
  }
  // Check RLS status on Soundfont table
  try {
    const rls: any[] = await prisma.$queryRaw`SELECT relname, relrowsecurity FROM pg_class WHERE relname='Soundfont'`
    console.log('RLS status:', JSON.stringify(rls))
  } catch (e: any) {
    console.log('Cannot check RLS:', e.message)
  }
}
main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect())
