import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const projectCount = await prisma.project.count()
        console.log('Project count:', projectCount)

        const demoProject = await prisma.project.findUnique({
            where: { id: 'demo-1' }
        })
        console.log('Demo project:', demoProject ? 'Found' : 'Not found')
    } catch (error) {
        console.error('Database error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
