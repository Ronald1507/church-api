import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Config de Prisma 7 para comandos CLI (db push, migrate, introspect).
// El runtime de la app NO usa esto: se conecta vía driver adapter en src/config/db.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
