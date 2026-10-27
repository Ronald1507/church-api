import 'dotenv/config';

export default {
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/church_manage?schema=public',
  },
};