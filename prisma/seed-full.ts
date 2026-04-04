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

const TIPOS_INSTITUCION = [
  { nombre: 'Coro', tipo: 'CORO' },
  { nombre: 'Jóvenes', tipo: 'JOVENES' },
  { nombre: 'Dorcas', tipo: 'DORCAS' },
  { nombre: 'Escuela Dominical', tipo: 'ESCUELA_DOMINICAL' },
  { nombre: 'Guardería', tipo: 'GUARDERIA' }
];

const TIPOS_MIEMBRO = [
  { nombre: 'MIEMBRO_ACTIVO', descripcion: 'Miembro activo que asiste regularmente' },
  { nombre: 'MIEMBRO_INACTIVO', descripcion: 'Miembro que no asiste frecuentemente' },
  { nombre: 'MIEMBRO_NUEVO', descripcion: 'Nuevo converso o nuevo en la congregación' },
  { nombre: 'MIEMBRO_BAUTIZADO', descripcion: 'Miembro bautizado' },
  { nombre: 'VISITANTE', descripcion: 'Visitante eventual' }
];

const ENTIDADES_ESTADO: Record<string, Array<{codigo: string; nombre: string; descripcion: string; es_final?: boolean}>> = {
  USUARIO: [
    { codigo: 'ACTIVO', nombre: 'Activo', descripcion: 'Usuario activo en el sistema' },
    { codigo: 'INACTIVO', nombre: 'Inactivo', descripcion: 'Usuario inactivo' }
  ],
  CONGREGACION: [
    { codigo: 'ACTIVA', nombre: 'Congregación activa', descripcion: 'Congregación activa' },
    { codigo: 'INACTIVA', nombre: 'Congregación inactiva', descripcion: 'Congregación inactiva' }
  ],
  MIEMBRO: [
    { codigo: 'ACTIVO', nombre: 'Miembro activo', descripcion: 'Miembro activo en la iglesia' },
    { codigo: 'INACTIVO', nombre: 'Miembro inactivo', descripcion: 'Miembro inactivo' },
    { codigo: 'ELIMINADO', nombre: 'Eliminado', descripcion: 'Miembro eliminado del sistema', es_final: true },
    { codigo: 'TRANSFERIDO', nombre: 'Transferido', descripcion: 'Miembro transferido a otra iglesia', es_final: true }
  ],
  INSTITUCION: [
    { codigo: 'ACTIVA', nombre: 'Institución activa', descripcion: 'Institución activa' },
    { codigo: 'INACTIVA', nombre: 'Institución inactiva', descripcion: 'Institución inactiva' }
  ],
  EVENTO: [
    { codigo: 'ACTIVO', nombre: 'Evento activo', descripcion: 'Evento programado' },
    { codigo: 'REALIZADO', nombre: 'Evento realizado', descripcion: 'Evento ya realizado', es_final: true },
    { codigo: 'CANCELADO', nombre: 'Evento cancelado', descripcion: 'Evento cancelado', es_final: true }
  ],
  TRANSACCION: [
    { codigo: 'PENDIENTE', nombre: 'Pendiente', descripcion: 'Transacción pendiente' },
    { codigo: 'CONFIRMADA', nombre: 'Confirmada', descripcion: 'Transacción confirmada' },
    { codigo: 'CANCELADA', nombre: 'Cancelada', descripcion: 'Transacción cancelada' }
  ],
  INVENTARIO: [
    { codigo: 'DISPONIBLE', nombre: 'Disponible', descripcion: 'Item disponible' },
    { codigo: 'EN USO', nombre: 'En uso', descripcion: 'Item en uso' },
    { codigo: 'EN MANTENCION', nombre: 'En mantención', descripcion: 'Item en mantención' },
    { codigo: 'BAJA', nombre: 'De baja', descripcion: 'Item dado de baja', es_final: true }
  ],
  MINISTERIO: [  // Keep for backward compatibility
    { codigo: 'ACTIVO', nombre: 'Ministerio activo', descripcion: 'Ministerio activo' }
  ]
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('=== SEED COMPLETO ===\n');

    // 1. Create estados for all entities
    console.log('1. Creating estados...');
    for (const [entidad, estados] of Object.entries(ENTIDADES_ESTADO)) {
      for (const e of estados) {
        await prisma.estado.upsert({
          where: { entidad_codigo: { entidad, codigo: e.codigo } },
          update: {},
          create: {
            entidad,
            codigo: e.codigo,
            nombre: e.nombre,
            descripcion: e.descripcion,
            es_estado_final: e.es_final || false
          }
        });
      }
    }
    console.log('✅ Estados creados');

    // 2. Create congregación
    console.log('\n2. Creating congregación...');
    const estadoCongregacion = await prisma.estado.findFirst({ 
      where: { entidad: 'CONGREGACION', codigo: 'ACTIVA' } 
    });
    
    const congregacion = await prisma.congregacion.upsert({
      where: { id_congregacion: 1 },
      update: {},
      create: {
        nombre: 'Iglesia Central',
        direccion: 'Av. Principal 123',
        ciudad: 'Santiago',
        region: 'Metropolitana',
        telefono: '+56221234567',
        email: 'iglesia@central.cl',
        id_estado: estadoCongregacion?.id_estado || 1
      }
    });
    console.log(`✅ Congregación creada: ${congregacion.nombre}`);

    // 3. Create tipos de miembro
    console.log('\n3. Creating tipos de miembro...');
    for (const tipo of TIPOS_MIEMBRO) {
      await prisma.tipoMiembro.upsert({
        where: { nombre: tipo.nombre },
        update: {},
        create: { nombre: tipo.nombre, descripcion: tipo.descripcion }
      });
    }
    console.log('✅ Tipos de miembro creados');

    // 4. Create RBAC
    console.log('\n4. Creating RBAC...');
    for (const recurso of RECURSOS) {
      for (const accion of ACCIONES) {
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

    const allPermisos = await prisma.permiso.findMany();

    for (const p of allPermisos) {
      try {
        await prisma.rolPermiso.create({
          data: { id_rol: rolSuperadmin.id_rol, id_permiso: p.id_permiso }
        });
      } catch {}
    }

    const adminPermisos = [
      ...ACCIONES.map(a => ({ recurso: 'miembros', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'instituciones', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'finanzas', accion: a })),
      ...ACCIONES.map(a => ({ recurso: 'eventos', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'inventario', accion: a })),
      ...['crear', 'leer', 'actualizar', 'admin'].map(a => ({ recurso: 'comunicaciones', accion: a })),
      ...['leer', 'admin'].map(a => ({ recurso: 'reportes', accion: a }))
    ];

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

    const usuarioPermisos = [
      { recurso: 'miembros', accion: 'leer' },
      { recurso: 'eventos', accion: 'leer' },
      { recurso: 'finanzas', accion: 'leer' },
      { recurso: 'reportes', accion: 'leer' }
    ];

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
    console.log('✅ RBAC creado');

    // 5. Create instituciones
    console.log('\n5. Creating instituciones...');
    const estadoInstitucionActiva = await prisma.estado.findFirst({ 
      where: { entidad: 'INSTITUCION', codigo: 'ACTIVA' } 
    });

    const institucionesCreadas = [];
    for (const inst of TIPOS_INSTITUCION) {
      const institucion = await prisma.institucion.create({
        data: {
          nombre: inst.nombre,
          tipo: inst.tipo,
          descripcion: `${inst.nombre} de la iglesia`,
          id_congregacion: congregacion.id_congregacion,
          id_estado: estadoInstitucionActiva?.id_estado || 1
        }
      });
      institucionesCreadas.push(institucion);
      console.log(`  ✅ ${inst.nombre} creada`);
    }

    // 6. Create tipos de relación familiar
    console.log('\n6. Creating tipos de relación familiar...');
    const relaciones = [
      { nombre: 'ESPOSO', nombre_inverso: 'ESPOSA', es_simetrica: false },
      { nombre: 'PADRE', nombre_inverso: 'HIJO', es_simetrica: false },
      { nombre: 'MADRE', nombre_inverso: 'HIJO', es_simetrica: false },
      { nombre: 'HERMANO', nombre_inverso: 'HERMANO', es_simetrica: true },
      { nombre: 'TIO', nombre_inverso: 'SOBRINO', es_simetrica: false },
      { nombre: 'PRIMO', nombre_inverso: 'PRIMO', es_simetrica: true }
    ];

    for (const rel of relaciones) {
      await prisma.tipoRelacionFamiliar.upsert({
        where: { nombre: rel.nombre },
        update: {},
        create: rel
      });
    }
    console.log('✅ Tipos de relación familiar creados');

    // 7. Create miembros de ejemplo
    console.log('\n7. Creating miembros de ejemplo...');
    const tipoActivo = await prisma.tipoMiembro.findFirst({ where: { nombre: 'MIEMBRO_ACTIVO' } });
    const estadoActivo = await prisma.estado.findFirst({ where: { entidad: 'MIEMBRO', codigo: 'ACTIVO' } });

    const miembrosData = [
      { nombres: 'Juan', apellidos: 'Pérez García', rut: '12345678-5', telefono: '+56912345678', email: 'juan.perez@email.cl' },
      { nombres: 'María', apellidos: 'González López', rut: '23456789-1', telefono: '+56923456789', email: 'maria.gonzalez@email.cl' },
      { nombres: 'Pedro', apellidos: 'Rodríguez Sánchez', rut: '34567890-2', telefono: '+56934567890', email: 'pedro.rodriguez@email.cl' },
      { nombres: 'Ana', apellidos: 'Martínez Torres', rut: '45678901-3', telefono: '+56945678901', email: 'ana.martinez@email.cl' },
      { nombres: 'Carlos', apellidos: 'López Hernández', rut: '56789012-4', telefono: '+56956789012', email: 'carlos.lopez@email.cl' }
    ];

    const miembrosCreados = [];
    for (const m of miembrosData) {
      const miembro = await prisma.miembro.create({
        data: {
          nombres: m.nombres,
          apellidos: m.apellidos,
          rut: m.rut,
          telefono: m.telefono,
          email: m.email,
          genero: 'M',
          estado_civil: 'CASADO',
          id_congregacion: congregacion.id_congregacion,
          id_estado: estadoActivo?.id_estado || 1,
          id_tipo_miembro: tipoActivo?.id_tipo || 1
        }
      });
      miembrosCreados.push(miembro);
    }
    console.log(`✅ ${miembrosCreados.length} miembros creados`);

    // 8. Relacionar miembros con instituciones
    console.log('\n8. Creating relaciones miembro-institución...');
    const estadoRelActivo = await prisma.estado.findFirst({ 
      where: { entidad: 'MIEMBRO', codigo: 'ACTIVO' } 
    });

    // Juan -> Coro (Líder)
    await prisma.miembroInstitucion.create({
      data: {
        id_miembro: miembrosCreados[0].id_miembro,
        id_institucion: institucionesCreadas[0].id_institucion,  // Coro
        rol: 'MIEMBRO',
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });
    await prisma.cargoInstitucion.create({
      data: {
        id_miembro: miembrosCreados[0].id_miembro,
        id_institucion: institucionesCreadas[0].id_institucion,
        rol: 'LIDER',
        fecha_inicio: new Date(),
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });

    // María -> Jóvenes (Líder)
    await prisma.miembroInstitucion.create({
      data: {
        id_miembro: miembrosCreados[1].id_miembro,
        id_institucion: institucionesCreadas[1].id_institucion,  // Jóvenes
        rol: 'MIEMBRO',
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });
    await prisma.cargoInstitucion.create({
      data: {
        id_miembro: miembrosCreados[1].id_miembro,
        id_institucion: institucionesCreadas[1].id_institucion,
        rol: 'LIDER',
        fecha_inicio: new Date(),
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });

    // Pedro -> Dorcas (Tesorero)
    await prisma.miembroInstitucion.create({
      data: {
        id_miembro: miembrosCreados[2].id_miembro,
        id_institucion: institucionesCreadas[2].id_institucion,  // Dorcas
        rol: 'MIEMBRO',
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });
    await prisma.cargoInstitucion.create({
      data: {
        id_miembro: miembrosCreados[2].id_miembro,
        id_institucion: institucionesCreadas[2].id_institucion,
        rol: 'TESORERO',
        fecha_inicio: new Date(),
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });

    // Ana -> Escuela Dominical (Secretario)
    await prisma.miembroInstitucion.create({
      data: {
        id_miembro: miembrosCreados[3].id_miembro,
        id_institucion: institucionesCreadas[3].id_institucion,  // Escuela Dominical
        rol: 'MIEMBRO',
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });
    await prisma.cargoInstitucion.create({
      data: {
        id_miembro: miembrosCreados[3].id_miembro,
        id_institucion: institucionesCreadas[3].id_institucion,
        rol: 'SECRETARIO',
        fecha_inicio: new Date(),
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });

    // Agregar algunos miembros adicionales como miembro simple
    await prisma.miembroInstitucion.create({
      data: {
        id_miembro: miembrosCreados[4].id_miembro,
        id_institucion: institucionesCreadas[0].id_institucion,  // Coro
        rol: 'MIEMBRO',
        id_estado: estadoRelActivo?.id_estado || 1
      }
    });

    console.log('✅ Relaciones miembro-institución creadas');

    // 9. Create usuarios de prueba
    console.log('\n9. Creating usuarios de prueba...');
    const passwordHash = await bcrypt.hash('password123', 10);
    const estadoUsuarioActivo = await prisma.estado.findFirst({ 
      where: { entidad: 'USUARIO', codigo: 'ACTIVO' } 
    });

    // Superadmin
    await prisma.usuarioSistema.upsert({
      where: { email: 'superadmin@iglesia.cl' },
      update: {},
      create: {
        username: 'superadmin',
        email: 'superadmin@iglesia.cl',
        password_hash: passwordHash,
        id_rol: rolSuperadmin.id_rol,
        id_estado: estadoUsuarioActivo?.id_estado || 1,
        nivel: NivelAcceso.SUPERADMIN,
        id_congregacion: null
      }
    });

    // Admin
    await prisma.usuarioSistema.upsert({
      where: { email: 'admin@iglesia.cl' },
      update: {},
      create: {
        username: 'admin_central',
        email: 'admin@iglesia.cl',
        password_hash: passwordHash,
        id_rol: rolAdmin.id_rol,
        id_estado: estadoUsuarioActivo?.id_estado || 1,
        nivel: NivelAcceso.ADMIN,
        id_congregacion: congregacion.id_congregacion
      }
    });

    // Usuario normal
    await prisma.usuarioSistema.upsert({
      where: { email: 'usuario@iglesia.cl' },
      update: {},
      create: {
        username: 'usuario_demo',
        email: 'usuario@iglesia.cl',
        password_hash: passwordHash,
        id_rol: rolUsuario.id_rol,
        id_estado: estadoUsuarioActivo?.id_estado || 1,
        nivel: NivelAcceso.USUARIO,
        id_congregacion: congregacion.id_congregacion
      }
    });

    console.log('✅ Usuarios creados:');
    console.log('   - superadmin@iglesia.cl / password123');
    console.log('   - admin@iglesia.cl / password123');
    console.log('   - usuario@iglesia.cl / password123');

    // 10. Actualizar niveles de usuarios existentes
    const existingUsers = await prisma.usuarioSistema.findMany({ include: { rol: true } });
    if (existingUsers.length > 0) {
      for (const user of existingUsers) {
        await prisma.usuarioSistema.update({
          where: { id_usuario: user.id_usuario },
          data: { nivel: user.rol.nivel }
        });
      }
      console.log(`✅ Actualizado nivel en ${existingUsers.length} usuarios existentes`);
    }

    console.log('\n=== ✅ SEED COMPLETADO ===');
    console.log('\nResumen:');
    console.log(`- Congregaciones: 1`);
    console.log(`- Instituciones: ${institucionesCreadas.length}`);
    console.log(`- Miembros: ${miembrosCreados.length}`);
    console.log(`- Usuarios: 3`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
