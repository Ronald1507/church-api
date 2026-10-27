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
  'reportes',
  'familia',
  'espiritual',
  'pastoral',
  'documentos',
  'auditoria'
];

const ACCIONES = ['crear', 'leer', 'actualizar', 'eliminar', 'admin'];

// Estados de los módulos nuevos (entidad -> estados). Idempotente vía upsert.
const ENTIDADES_ESTADO_MODULOS: Record<string, Array<{ codigo: string; nombre: string; descripcion: string; es_final?: boolean }>> = {
  VISITA_PASTORAL: [
    { codigo: 'PROGRAMADA', nombre: 'Programada', descripcion: 'Visita pastoral programada' },
    { codigo: 'REALIZADA', nombre: 'Realizada', descripcion: 'Visita pastoral realizada', es_final: true },
    { codigo: 'CANCELADA', nombre: 'Cancelada', descripcion: 'Visita pastoral cancelada', es_final: true }
  ],
  PETICION_ORACION: [
    { codigo: 'ACTIVA', nombre: 'Activa', descripcion: 'Petición de oración activa' },
    { codigo: 'RESPONDIDA', nombre: 'Respondida', descripcion: 'Oración respondida', es_final: true },
    { codigo: 'CERRADA', nombre: 'Cerrada', descripcion: 'Petición cerrada', es_final: true }
  ],
  COMUNICACION: [
    { codigo: 'BORRADOR', nombre: 'Borrador', descripcion: 'Comunicación en borrador' },
    { codigo: 'ENVIADA', nombre: 'Enviada', descripcion: 'Comunicación enviada' },
    { codigo: 'ANULADA', nombre: 'Anulada', descripcion: 'Comunicación anulada', es_final: true }
  ],
  DOCUMENTO: [
    { codigo: 'VIGENTE', nombre: 'Vigente', descripcion: 'Documento vigente' },
    { codigo: 'ANULADO', nombre: 'Anulado', descripcion: 'Documento anulado', es_final: true }
  ],
  CARGO_INSTITUCION: [
    { codigo: 'ACTIVO', nombre: 'Activo', descripcion: 'Cargo vigente' },
    { codigo: 'FINALIZADO', nombre: 'Finalizado', descripcion: 'Cargo finalizado', es_final: true }
  ]
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('Seeding estados de módulos...');
    for (const [entidad, estados] of Object.entries(ENTIDADES_ESTADO_MODULOS)) {
      for (const e of estados) {
        await prisma.estado.upsert({
          where: { entidad_codigo: { entidad, codigo: e.codigo } },
          update: {},
          create: { entidad, codigo: e.codigo, nombre: e.nombre, descripcion: e.descripcion, es_estado_final: e.es_final || false }
        });
      }
    }
    console.log('✅ Estados de módulos creados');

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
      ...['leer', 'admin'].map(a => ({ recurso: 'reportes', accion: a })),
      ...ACCIONES.map(a => ({ recurso: 'familia', accion: a })),
      ...ACCIONES.map(a => ({ recurso: 'espiritual', accion: a })),
      ...ACCIONES.map(a => ({ recurso: 'pastoral', accion: a })),
      ...ACCIONES.map(a => ({ recurso: 'documentos', accion: a })),
      ...['leer', 'admin'].map(a => ({ recurso: 'auditoria', accion: a }))
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
    
    // Seed catálogos normalizados
    console.log('\nSeeding catálogos...');
    
    // Tipos de transacción
    const tiposTransaccion = [
      { nombre: 'INGRESO', descripcion: 'Dinero que entra', naturaleza: 'ENTRADA' },
      { nombre: 'EGRESO', descripcion: 'Dinero que sale', naturaleza: 'SALIDA' }
    ];
    for (const tipo of tiposTransaccion) {
      const existing = await prisma.tipoTransaccion.findFirst({ where: { nombre: tipo.nombre } });
      if (!existing) {
        await prisma.tipoTransaccion.create({ data: tipo });
        console.log(`Created tipo: ${tipo.nombre}`);
      }
    }
    
    // Métodos de pago
    const metodosPago = [
      { nombre: 'EFECTIVO', descripcion: 'Pago en efectivo' },
      { nombre: 'TRANSFERENCIA', descripcion: 'Transferencia bancaria' },
      { nombre: 'DEPOSITO', descripcion: 'Depósito en cuenta' },
      { nombre: 'CHEQUE', descripcion: 'Pago con cheque' }
    ];
    for (const metodo of metodosPago) {
      const existing = await prisma.metodoPago.findFirst({ where: { nombre: metodo.nombre } });
      if (!existing) {
        await prisma.metodoPago.create({ data: metodo });
        console.log(`Created método: ${metodo.nombre}`);
      }
    }
    
    // Roles de servicio
    const rolesServicio = [
      { nombre: 'COORDINADOR', descripcion: 'Coordina el servicio' },
      { nombre: 'PREDICADOR', descripcion: 'Predica el mensaje' },
      { nombre: 'COMPUTADOR', descripcion: 'Maneja equipo de sonido' },
      { nombre: 'PORTERO', descripcion: 'Controla la puerta' },
      { nombre: 'SONIDOR', descripcion: 'Maneja audio' },
      { nombre: 'LIDER_ALABANZA', descripcion: 'Lidera la alabanza' },
      { nombre: 'MUSICO', descripcion: 'Toca instrumento' },
      { nombre: 'CANTANTE', descripcion: 'Canta en el coro' },
      { nombre: 'AYUDANTE', descripcion: 'Ayuda general' }
    ];
    for (const rol of rolesServicio) {
      const existing = await prisma.rolServicio.findFirst({ where: { nombre: rol.nombre } });
      if (!existing) {
        await prisma.rolServicio.create({ data: rol });
        console.log(`Created rol servicio: ${rol.nombre}`);
      }
    }
    
    console.log('\n✅ Catálogos seeded successfully!');
  } catch (error) {
    console.error('Error seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
