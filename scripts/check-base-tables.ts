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
    console.log('=== VERIFICANDO DATOS EXISTENTES ===\n');

    // Check Estados
    const estados = await prisma.estado.findMany();
    console.log(`Estados: ${estados.length} registros`);
    
    // Check TipoMiembro
    const tiposMiembro = await prisma.tipoMiembro.findMany();
    console.log(`Tipos de Miembro: ${tiposMiembro.length} registros`);
    if (tiposMiembro.length === 0) console.log('  ⚠️  VACÍO - Necesita seed');
    
    // Check TipoRelacionFamiliar
    const tiposRelacion = await prisma.tipoRelacionFamiliar.findMany();
    console.log(`Tipos de Relación Familiar: ${tiposRelacion.length} registros`);
    if (tiposRelacion.length === 0) console.log('  ⚠️  VACÍO - Necesita seed');
    
    // Check TipoHito
    const tiposHito = await prisma.tipoHito.findMany();
    console.log(`Tipos de Hito: ${tiposHito.length} registros`);
    if (tiposHito.length === 0) console.log('  ⚠️  VACÍO - Necesita seed');
    
    // Check Congregaciones
    const congregaciones = await prisma.congregacion.findMany();
    console.log(`Congregaciones: ${congregaciones.length} registros`);
    
    // Check Ministerio
    const ministerios = await prisma.ministerio.findMany();
    console.log(`Ministerios: ${ministerios.length} registros`);
    
    // Check Miembros
    const miembros = await prisma.miembro.findMany();
    console.log(`Miembros: ${miembros.length} registros`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();