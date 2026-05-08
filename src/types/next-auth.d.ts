declare module "next-auth" {
  type UserRole = 'admin' | 'user'

  interface Session {
    user: {
      id: string
      name?: string | null
      image?: string | null
      role?: UserRole
    }
  }

  interface User {
    id: string
    name?: string | null
    image?: string | null
    role?: UserRole
  }
}

declare module "next-auth/jwt" {
  type UserRole = 'admin' | 'user'

  interface JWT {
    id: string
    role?: UserRole
  }
}
