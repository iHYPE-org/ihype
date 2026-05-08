import 'dotenv/config'
import { defineConfig } from 'prisma/config'

if (!process.env.DATABASE_URL && process.env.DATABASE_URL_POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_POSTGRES_PRISMA_URL
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
})
