import { PrismaClient, NivelAcceso } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const { Pool } = pg;

const RECURSOS = [
  'miembros',
  'instituciones',
  'finanzas',
  'eventos',
  'inventario',
  'comunicaciones',
  'usuarios',
  'configuracion',
  'reportes'
];

const ACCIONES = ['crear', 'leer', 'actualizar', 'eliminar', 'admin'];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('Seeding RBAC...');

    const recursosSet = new Set(RECURSOS);
    const accionesSet = new Set(ACCIONES);

    for (const recurso of recursosSet) {
      for (const accion of accionesSet) {
        try {
          const existing = await prisma.permiso.findFirst({ where: { recurso, accion } });
          if (!existing) {
            await prisma.permiso.create({
              data: { recurso, accion, descripcion: `${accion} sobre ${recurso}` }
            });
          }
        } catch {}
      }
    }
    console.log(`Created ${RECURSOS.length * ACCIONES.length} permisos`);

    const rolSuperadmin = await prisma.rolSistema.upsert({
      where: { nombre: 'SUPERADMIN' },
      update: { nivel: NivelAcceso.SUPERADMIN },
      create: { nombre: 'SUPERADMIN', descripcion: 'Super Administrador del sistema', nivel: NivelAcceso.SUPERADMIN }
    });

    const rolAdmin = await prisma.rolSistema.upsert({
      where: { nombre: 'ADMIN' },
      update: { nivel: NivelAcceso.ADMIN },
      create: { nombre: 'ADMIN', descripcion: 'Administrador de congregación', nivel: NivelAcceso.ADMIN }
    });

    const rolUsuario = await prisma.rolSistema.upsert({
      where: { nombre: 'USUARIO' },
      update: { nivel: NivelAcceso.USUARIO },
      create: { nombre: 'USUARIO', descripcion: 'Usuario regular', nivel: NivelAcceso.USUARIO }
    });

    console.log('Created roles: SUPERADMIN, ADMIN, USUARIO');

    const adminPermisos = [
      ...ACCIONES.map(a => ({ recurso: 'miembros', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'instituciones', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'finanzas', accion: a })),
      ...ACCIONES.map(a => ({ recurso: 'eventos', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'inventario', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'comunicaciones', accion: a })),
      ...['leer', 'admin'].map(a => ({ recurso: 'reportes', accion: a }))
    ];

    const usuarioPermisos = [
      { recurso: 'miembros', accion: 'leer' },
      { recurso: 'eventos', accion: 'leer' },
      { recurso: 'finanzas', accion: 'leer' },
      { recurso: 'reportes', accion: 'leer' }
    ];

    const allPermisos = await prisma.permiso.findMany();

    for (const p of allPermisos) {
      try {
        await prisma.rolPermiso.create({
          data: { id_rol: rolSuperadmin.id_rol, id_permiso: p.id_permiso }
        });
      } catch {}
    }
    console.log('Asignados todos los permisos a SUPERADMIN');

    for (const p of adminPermisos) {
      const permiso = allPermisos.find((x: any) => x.recurso === p.recurso && x.accion === p.accion);
      if (permiso) {
        try {
          await prisma.rolPermiso.create({
            data: { id_rol: rolAdmin.id_rol, id_permiso: permiso.id_permiso }
          });
        } catch {}
      }
    }
    console.log('Asignados permisos a ADMIN');

    for (const p of usuarioPermisos) {
      const permiso = allPermisos.find((x: any) => x.recurso === p.recurso && x.accion === p.accion);
      if (permiso) {
        try {
          await prisma.rolPermiso.create({
            data: { id_rol: rolUsuario.id_rol, id_permiso: permiso.id_permiso }
          });
        } catch {}
      }
    }
    console.log('Asignados permisos a USUARIO');

    const existingUsers = await prisma.usuarioSistema.findMany({ include: { rol: true } });
    if (existingUsers.length > 0) {
      for (const user of existingUsers) {
        await prisma.usuarioSistema.update({
          where: { id_usuario: user.id_usuario },
          data: { nivel: user.rol.nivel }
        });
      }
      console.log(`Actualizado nivel en ${existingUsers.length} usuarios existentes`);
    }

    console.log('\n✅ RBAC seeded successfully!');
  } catch (error) {
    console.error('Error seeding RBAC:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
