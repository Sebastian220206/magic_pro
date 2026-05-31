const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const email = process.env.SEED_EMAIL || 'dev@example.com'
  const password = process.env.SEED_PASSWORD || 'devpassword123'
  const name = process.env.SEED_NAME || 'Dev User'

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.deleteMany({});
  const user = await prisma.user.create({ data: { id: 'user-1', email, passwordHash, name } });

  console.log(`User created: ${user.email} (id: ${user.id})`)
  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
