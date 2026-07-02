import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('test1234', 12)
  await prisma.user.update({
    where: { email: 'test@test.com' },
    data: { passwordHash: hash }
  })
  console.log('Password reset for test@test.com')
}
main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect())
