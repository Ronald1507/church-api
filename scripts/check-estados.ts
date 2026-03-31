import 'dotenv/config';
import { PrismaClient, NivelAcceso } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    // List all estados
    console.log('=== ESTADOS DISPONIBLES ===');
    const estados = await prisma.estado.findMany({ take: 20 });
    console.log(JSON.stringify(estados, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();