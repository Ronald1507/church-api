require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Seeding database...');

    // Create Estados
    const estados = await Promise.all([
      prisma.estado.create({
        data: { entidad: 'USUARIO', codigo: 'ACTIVO', nombre: 'Activo', descripcion: 'Usuario activo en el sistema', es_estado_final: false }
      }),
      prisma.estado.create({
        data: { entidad: 'USUARIO', codigo: 'INACTIVO', nombre: 'Inactivo', descripcion: 'Usuario inactivo', es_estado_final: false }
      }),
      prisma.estado.create({
        data: { entidad: 'MIEMBRO', codigo: 'ACTIVO', nombre: 'Miembro activo', descripcion: 'Miembro activo en la iglesia', es_estado_final: false }
      }),
      prisma.estado.create({
        data: { entidad: 'MIEMBRO', codigo: 'INACTIVO', nombre: 'Miembro inactivo', descripcion: 'Miembro inactivo', es_estado_final: false }
      }),
      prisma.estado.create({
        data: { entidad: 'MIEMBRO', codigo: 'TRANSFERIDO', nombre: 'Transferido', descripcion: 'Miembro transferido a otra iglesia', es_estado_final: true }
      }),
      prisma.estado.create({
        data: { entidad: 'MINISTERIO', codigo: 'ACTIVO', nombre: 'Ministerio activo', descripcion: 'Ministerio activo', es_estado_final: false }
      }),
      prisma.estado.create({
        data: { entidad: 'CONGREGACION', codigo: 'ACTIVA', nombre: 'Congregación activa', descripcion: 'Congregación activa', es_estado_final: false }
      }),
    ]);

    console.log(`Created ${estados.length} estados`);

    // Create Roles
    const roles = await Promise.all([
      prisma.rolSistema.create({
        data: { nombre: 'ADMIN', descripcion: 'Administrador del sistema', permisos: { all: true } }
      }),
      prisma.rolSistema.create({
        data: { nombre: 'PASTOR', descripcion: 'Pastor principal', permisos: { members: true, ministries: true, finances: true } }
      }),
      prisma.rolSistema.create({
        data: { nombre: 'USUARIO', descripcion: 'Usuario regular', permisos: { members: 'read' } }
      }),
    ]);

    console.log(`Created ${roles.length} roles`);

    // Create TipoMiembro
    const tipos = await Promise.all([
      prisma.tipoMiembro.create({
        data: { nombre: 'MIEMBRO', descripcion: 'Miembro regular de la iglesia' }
      }),
      prisma.tipoMiembro.create({
        data: { nombre: 'VISITANTE', descripcion: 'Visitante frecuente' }
      }),
      prisma.tipoMiembro.create({
        data: { nombre: 'DISCIPULO', descripcion: 'En proceso de discipulado' }
      }),
    ]);

    console.log(`Created ${tipos.length} tipos de miembro`);

    // Create Congregacion
    const congregacion = await prisma.congregacion.create({
      data: {
        nombre: 'Iglesia Central',
        direccion: 'Av. Principal 123',
        ciudad: 'Santiago',
        region: 'Metropolitana',
        id_estado: estados[6].id_estado
      }
    });

    console.log('Created congregación:', congregacion.nombre);

    console.log('\n✅ Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
