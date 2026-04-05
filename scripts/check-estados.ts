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
    console.log('=== AGREGANDO ESTADOS FALTANTES ===\n');

    // Estados faltantes para FINANZA_CUENTA
    const estadosFinanza = [
      { entidad: 'FINANZA_CUENTA', codigo: 'ACTIVA', nombre: 'Cuenta activa', descripcion: 'Cuenta activa', es_estado_final: false },
      { entidad: 'FINANZA_CUENTA', codigo: 'INACTIVA', nombre: 'Cuenta inactiva', descripcion: 'Cuenta inactiva', es_estado_final: false }
    ];

    for (const e of estadosFinanza) {
      const existente = await prisma.estado.findFirst({
        where: { entidad: e.entidad, codigo: e.codigo }
      });
      
      if (!existente) {
        await prisma.estado.create({ data: e });
        console.log(`✅ Creado: ${e.entidad}.${e.codigo}`);
      } else {
        console.log(`⏭️  Ya existe: ${e.entidad}.${e.codigo} (id ${existente.id_estado})`);
      }
    }

    // Verificar que MIEMBRO.ELIMINADO existe
    const miembroEliminado = await prisma.estado.findFirst({
      where: { entidad: 'MIEMBRO', codigo: 'ELIMINADO' }
    });
    
    if (!miembroEliminado) {
      await prisma.estado.create({
        data: {
          entidad: 'MIEMBRO',
          codigo: 'ELIMINADO',
          nombre: 'Ex miembro',
          descripcion: 'Ex miembro de la iglesia',
          es_estado_final: true
        }
      });
      console.log('✅ Creado: MIEMBRO.ELIMINADO');
    } else {
      console.log(`⏭️  Ya existe: MIEMBRO.ELIMINADO (id ${miembroEliminado.id_estado})`);
    }

    console.log('\n=== ESTADOS ACTUALIZADOS ===');
    const estados = await prisma.estado.findMany({
      orderBy: [{ entidad: 'asc' }, { nombre: 'asc' }]
    });

    const grouped = estados.reduce((acc, e) => {
      if (!acc[e.entidad]) acc[e.entidad] = [];
      acc[e.entidad].push({ id: e.id_estado, codigo: e.codigo, nombre: e.nombre });
      return acc;
    }, {} as Record<string, Array<{id: number, codigo: string, nombre: string}>>);

    for (const [entidad, lista] of Object.entries(grouped)) {
      console.log(`\n📁 ${entidad}:`);
      for (const e of lista) {
        console.log(`   [${e.id}] ${e.codigo} - ${e.nombre}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
