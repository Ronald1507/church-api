import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('=== USUARIOS ACTUALES ===');
    const users = await prisma.usuarioSistema.findMany({ 
      include: { rol: true },
      take: 10
    });
    console.log('Users:', JSON.stringify(users, null, 2));
    
    console.log('\n=== ROLES DISPONIBLES ===');
    const roles = await prisma.rolSistema.findMany();
    console.log('Roles:', JSON.stringify(roles, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();