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
    // Get roles
    const superadminRol = await prisma.rolSistema.findUnique({ where: { nombre: 'SUPERADMIN' } });
    const adminRol = await prisma.rolSistema.findUnique({ where: { nombre: 'ADMIN' } });
    const usuarioRol = await prisma.rolSistema.findUnique({ where: { nombre: 'USUARIO' } });

    console.log('Roles:', { superadmin: superadminRol?.nombre, admin: adminRol?.nombre, usuario: usuarioRol?.nombre });

    // Get estado for users
    const estadoActivo = await prisma.estado.findFirst({ 
      where: { entidad: 'USUARIO', codigo: 'ACTIVO' } 
    });

    if (!estadoActivo) {
      console.log('ERROR: No se encontró estado ACTIVO para USUARIO');
      return;
    }
    console.log('Estado activo encontrado:', estadoActivo.id_estado);

    // Get or create congregación
    let congregacion = await prisma.congregacion.findFirst();
    if (!congregacion) {
      const estadoCongregacion = await prisma.estado.findFirst({ 
        where: { entidad: 'CONGREGACION', codigo: 'ACTIVA' } 
      });
      
      if (estadoCongregacion) {
        congregacion = await prisma.congregacion.create({
          data: {
            nombre: 'Iglesia Central',
            ciudad: 'Santiago',
            region: 'Metropolitana',
            telefono: '+56221234567',
            email: 'iglesia@central.cl',
            id_estado: estadoCongregacion.id_estado
          }
        });
        console.log('Congregación creada:', congregacion.nombre);
      }
    } else {
      console.log('Congregación encontrada:', congregacion.nombre);
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Create SUPERADMIN user
    await prisma.usuarioSistema.upsert({
      where: { email: 'superadmin@iglesia.cl' },
      update: {},
      create: {
        username: 'superadmin',
        email: 'superadmin@iglesia.cl',
        password_hash: passwordHash,
        id_rol: superadminRol!.id_rol,
        id_estado: estadoActivo.id_estado,
        nivel: NivelAcceso.SUPERADMIN,
        id_congregacion: null
      }
    });
    console.log('✅ SUPERADMIN: superadmin@iglesia.cl / password123');

    // 2. Create ADMIN user
    await prisma.usuarioSistema.upsert({
      where: { email: 'admin@iglesia.cl' },
      update: {},
      create: {
        username: 'admin_central',
        email: 'admin@iglesia.cl',
        password_hash: passwordHash,
        id_rol: adminRol!.id_rol,
        id_estado: estadoActivo.id_estado,
        nivel: NivelAcceso.ADMIN,
        id_congregacion: congregacion?.id_congregacion || 1
      }
    });
    console.log('✅ ADMIN: admin@iglesia.cl / password123');

    // 3. Create USUARIO user
    await prisma.usuarioSistema.upsert({
      where: { email: 'usuario@iglesia.cl' },
      update: {},
      create: {
        username: 'usuario_demo',
        email: 'usuario@iglesia.cl',
        password_hash: passwordHash,
        id_rol: usuarioRol!.id_rol,
        id_estado: estadoActivo.id_estado,
        nivel: NivelAcceso.USUARIO,
        id_congregacion: congregacion?.id_congregacion || 1
      }
    });
    console.log('✅ USUARIO: usuario@iglesia.cl / password123');

    console.log('\n=== USUARIOS CREADOS ===');
    const usuarios = await prisma.usuarioSistema.findMany({
      include: { rol: true }
    });
    console.log(JSON.stringify(usuarios, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();