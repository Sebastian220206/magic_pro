const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    const user = await prisma.user.upsert({
        where: { email: 'demo@example.com' },
        update: {},
        create: {
            id: 'user-1',
            username: 'demouser',
            email: 'demo@example.com',
        },
    })

    const project = await prisma.project.upsert({
        where: { id: 'demo-1' },
        update: {},
        create: {
            id: 'demo-1',
            userId: user.id,
            name: 'Logic Pro Project',
            tempo: 120,
            tracks: {
                create: [
                    {
                        id: 'track-1',
                        name: 'Analog Deep Bass',
                        type: 'midi',
                        volume: 0.8,
                        pan: 0,
                        color: '#34d399',
                        orderIndex: 0,
                        clips: {
                            create: [
                                {
                                    id: 'clip-1',
                                    name: 'Bass Line',
                                    type: 'midi',
                                    start: 0,
                                    duration: 4,
                                    color: '#34d399',
                                    notes: {
                                        create: [
                                            { pitch: 36, velocity: 100, start: 0, duration: 1 },
                                            { pitch: 36, velocity: 100, start: 1, duration: 1 },
                                            { pitch: 36, velocity: 100, start: 2, duration: 1 },
                                            { pitch: 36, velocity: 100, start: 3, duration: 1 },
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
    })

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
