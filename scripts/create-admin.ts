import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { USER_ROLES } from '@/lib/user-role'

function readArg(name: string): string {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length).trim()

  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0) return (process.argv[index + 1] || '').trim()
  return ''
}

async function main() {
  const username = readArg('username') || process.env.ADMIN_USERNAME?.trim() || ''
  const password = readArg('password') || process.env.ADMIN_PASSWORD?.trim() || ''

  if (!username) {
    throw new Error('ADMIN_CREATE_INVALID: missing --username or ADMIN_USERNAME')
  }
  if (!password || password.length < 6) {
    throw new Error('ADMIN_CREATE_INVALID: password must be at least 6 characters')
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { name: username },
      select: { id: true, name: true, role: true },
    })

    const admin = existing
      ? await tx.user.update({
        where: { id: existing.id },
        data: {
          password: hashedPassword,
          role: USER_ROLES.ADMIN,
        },
        select: { id: true, name: true, role: true },
      })
      : await tx.user.create({
        data: {
          name: username,
          password: hashedPassword,
          role: USER_ROLES.ADMIN,
        },
        select: { id: true, name: true, role: true },
      })

    await tx.userBalance.upsert({
      where: { userId: admin.id },
      create: {
        userId: admin.id,
        balance: 0,
        frozenAmount: 0,
        totalSpent: 0,
      },
      update: {},
    })

    return admin
  })

  process.stdout.write(`管理员账号已就绪：${user.name} (${user.id})\n`)
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
