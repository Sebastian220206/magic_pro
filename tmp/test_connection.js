const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    console.log('Testing connection...')
    try {
        const result = await prisma.$queryRaw`SELECT 1 as result`
        console.log('Successfully connected to the database!')
        console.log('Connection test result:', result)
    } catch (err) {
        console.error('Database connection failed!')
        console.error('Check if your DATABASE_URL in the .env file has the correct password.')
        console.error(err.message)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
