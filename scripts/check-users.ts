import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } })
  console.log('Existing users:', JSON.stringify(users))

  if (users.length === 0) {
    console.log('Creating test user...')
    const hash = await bcrypt.hash('test1234', 12)
    const user = await prisma.user.create({
      data: { id: 'test-user-1', email: 'test@test.com', name: 'Test User', passwordHash: hash }
    })
    console.log('Created:', JSON.stringify({ id: user.id, email: user.email }))
  }
}

main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect())
