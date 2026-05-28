import { Role } from '@prisma/client'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      orgId: string
      role: Role
      agentId: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    orgId: string
    role: Role
    agentId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    orgId: string
    role: Role
    agentId: string | null
  }
}
