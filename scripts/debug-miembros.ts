import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('=== DEBUG MIEMBROS ===');
    
    // Test 1: Simple query
    console.log('\n1. Testing simple findMany...');
    const all = await prisma.miembro.findMany({ take: 2 });
    console.log('  Result:', all.length, 'records');
    
    // Test 2: With include estado
    console.log('\n2. Testing with include estado...');
    const withEstado = await prisma.miembro.findMany({
      take: 2,
      include: { estado: true }
    });
    console.log('  Result:', withEstado.length, 'records');
    
    // Test 3: With include tipoMiembro  
    console.log('\n3. Testing with include tipoMiembro...');
    const withTipo = await prisma.miembro.findMany({
      take: 2,
      include: { tipoMiembro: true }
    });
    console.log('  Result:', withTipo.length, 'records');
    
    // Test 4: With include Ministerio (correct field name)
    console.log('\n4. Testing with include Ministerio...');
    const withMin = await prisma.miembro.findMany({
      take: 2,
      include: { Ministerio: true }
    });
    console.log('  Result:', withMin.length, 'records');
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();