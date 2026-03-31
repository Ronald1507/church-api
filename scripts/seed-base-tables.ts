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
    console.log('=== SEEDING TABLAS BASE DEL SISTEMA ===\n');

    // ===============================
    // 1. TIPO MIEMBRO
    // ===============================
    console.log('📋 Creando Tipos de Miembro...');
    
    const tiposMiembro = [
      { nombre: 'MIEMBRO_ACTIVO', descripcion: 'Miembro activo que asiste regularmente' },
      { nombre: 'MIEMBRO_INACTIVO', descripcion: 'Miembro que no asiste frecuentemente' },
      { nombre: 'MIEMBRO_NUEVO', descripcion: 'Nuevo converso o nuevo en la congregación' },
      { nombre: 'VISITANTE', descripcion: 'Visitante eventual' },
      { nombre: 'MIEMBRO_BAUTIZADO', descripcion: 'Miembro bautizado' },
    ];

    for (const tipo of tiposMiembro) {
      await prisma.tipoMiembro.upsert({
        where: { nombre: tipo.nombre },
        update: {},
        create: tipo
      });
    }
    console.log(`  ✅ ${tiposMiembro.length} tipos de miembro`);

    // ===============================
    // 2. TIPO RELACION FAMILIAR
    // ===============================
    console.log('👨‍👩‍👧‍👦 Creando Tipos de Relación Familiar...');
    
    const tiposRelacion = [
      { nombre: 'PADRE', nombre_inverso: 'HIJO', es_simetrica: false },
      { nombre: 'MADRE', nombre_inverso: 'HIJO', es_simetrica: false },
      { nombre: 'HIJO', nombre_inverso: 'PADRE', es_simetrica: false },
      { nombre: 'HIJA', nombre_inverso: 'PADRE', es_simetrica: false },
      { nombre: 'HERMANO', nombre_inverso: 'HERMANO', es_simetrica: true },
      { nombre: 'HERMANA', nombre_inverso: 'HERMANO', es_simetrica: true },
      { nombre: 'ESPOSO', nombre_inverso: 'ESPOSA', es_simetrica: true },
      { nombre: 'ESPOSA', nombre_inverso: 'ESPOSO', es_simetrica: true },
      { nombre: 'ABUELO', nombre_inverso: 'NIETO', es_simetrica: false },
      { nombre: 'ABUELA', nombre_inverso: 'NIETO', es_simetrica: false },
      { nombre: 'NIETO', nombre_inverso: 'ABUELO', es_simetrica: false },
      { nombre: 'TIO', nombre_inverso: 'SOBRINO', es_simetrica: false },
      { nombre: 'TIA', nombre_inverso: 'SOBRINO', es_simetrica: false },
      { nombre: 'SOBRINO', nombre_inverso: 'TIO', es_simetrica: false },
      { nombre: 'PRIMO', nombre_inverso: 'PRIMO', es_simetrica: true },
    ];

    for (const tipo of tiposRelacion) {
      await prisma.tipoRelacionFamiliar.upsert({
        where: { nombre: tipo.nombre },
        update: {},
        create: tipo
      });
    }
    console.log(`  ✅ ${tiposRelacion.length} tipos de relación familiar`);

    // ===============================
    // 3. TIPO HITO
    // ===============================
    console.log('🎯 Creando Tipos de Hito Espiritual...');
    
    const tiposHito = [
      { nombre: 'BAUTISMO', descripcion: 'Bautismo en agua', requiere_ministro: true, genera_documento: true },
      { nombre: 'CONFESION', descripcion: 'Confesión de fe', requiere_ministro: true, genera_documento: false },
      { nombre: 'CONFIRMACION', descripcion: 'Confirmación eclesiástica', requiere_ministro: true, genera_documento: true },
      { nombre: 'MATRIMONIO', descripcion: 'Matrimonio eclesiástico', requiere_ministro: true, genera_documento: true },
      { nombre: 'ORDENACION', descripcion: 'Ordenación ministerial', requiere_ministro: true, genera_documento: true },
      { nombre: 'CONVERSION', descripcion: 'Conversión espiritual', requiere_ministro: false, genera_documento: false },
      { nombre: 'BAUTISMO_ESPÍRITU', descripcion: 'Bautismo del Espíritu Santo', requiere_ministro: false, genera_documento: false },
    ];

    for (const tipo of tiposHito) {
      await prisma.tipoHito.upsert({
        where: { nombre: tipo.nombre },
        update: {},
        create: tipo
      });
    }
    console.log(`  ✅ ${tiposHito.length} tipos de hito`);

    // ===============================
    // 4. MINISTERIOS
    // ===============================
    console.log('⛪ Creando Ministerios...');
    
    // Get congregation
    const congregacion = await prisma.congregacion.findFirst();
    if (!congregacion) {
      console.log('  ⚠️  No hay congregación, saltando ministerios');
    } else {
      const estadoActivo = await prisma.estado.findFirst({
        where: { entidad: 'MINISTERIO', codigo: 'ACTIVO' }
      });
      
      if (!estadoActivo) {
        console.log('  ⚠️  No hay estado ACTIVO para ministerio');
      } else {
        const ministerios = [
          { nombre: 'Ministerio de Alabanza', descripcion: 'Música y adoración', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Misiones', descripcion: 'Trabajo misiologico local e internacional', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Jóvenes', descripcion: 'Trabajo con jóvenes', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Niños', descripcion: 'Trabajo con niños', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Diaconía', descripcion: 'Servicio y ayuda social', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Educación', descripcion: 'Escuela bíblica y formación', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Varones', descripcion: 'Trabajo con hombres', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
          { nombre: 'Ministerio de Señoras', descripcion: 'Trabajo con mujeres', id_congregacion: congregacion.id_congregacion, id_estado: estadoActivo.id_estado },
        ];

        for (const min of ministerios) {
          await prisma.ministerio.upsert({
            where: { id_ministerio: min.nombre.startsWith('Ministerio de') ? (await prisma.ministerio.findFirst({ where: { nombre: min.nombre } }))?.id_ministerio || 0 : 0 },
            update: min,
            create: min
          });
        }
        
        // Use create for new ones to avoid ID issues
        for (const min of ministerios) {
          const exists = await prisma.ministerio.findFirst({ where: { nombre: min.nombre } });
          if (!exists) {
            await prisma.ministerio.create({ data: min });
          }
        }
        console.log(`  ✅ ${ministerios.length} ministerios`);
      }
    }

    // ===============================
    // 5. MIEMBROS DE PRUEBA
    // ===============================
    console.log('👥 Creando Miembros de Prueba...');
    
    if (congregacion) {
      const tipoMiembroActivo = await prisma.tipoMiembro.findUnique({ where: { nombre: 'MIEMBRO_ACTIVO' } });
      const estadoMiembroActivo = await prisma.estado.findFirst({ where: { entidad: 'MIEMBRO', codigo: 'ACTIVO' } });
      
      if (tipoMiembroActivo && estadoMiembroActivo) {
        const miembros = [
          { nombres: 'Juan', apellidos: 'Pérez García', rut: '12345678-5', telefono: '+56912345678', email: 'juan.perez@email.cl', genero: 'M', estado_civil: 'CASADO', id_congregacion: congregacion.id_congregacion, id_tipo_miembro: tipoMiembroActivo.id_tipo, id_estado: estadoMiembroActivo.id_estado },
          { nombres: 'María', apellidos: 'González López', rut: '23456789-6', telefono: '+56923456789', email: 'maria.gonzalez@email.cl', genero: 'F', estado_civil: 'CASADA', id_congregacion: congregacion.id_congregacion, id_tipo_miembro: tipoMiembroActivo.id_tipo, id_estado: estadoMiembroActivo.id_estado },
          { nombres: 'Pedro', apellidos: 'Rodríguez Smith', rut: '34567890-7', telefono: '+56934567890', email: 'pedro.rodriguez@email.cl', genero: 'M', estado_civil: 'SOLTERO', id_congregacion: congregacion.id_congregacion, id_tipo_miembro: tipoMiembroActivo.id_tipo, id_estado: estadoMiembroActivo.id_estado },
          { nombres: 'Ana', apellidos: 'Martínez Hernández', rut: '45678901-8', telefono: '+56945678901', email: 'ana.martinez@email.cl', genero: 'F', estado_civil: 'SOLTERA', id_congregacion: congregacion.id_congregacion, id_tipo_miembro: tipoMiembroActivo.id_tipo, id_estado: estadoMiembroActivo.id_estado },
          { nombres: 'Carlos', apellidos: 'López Fernández', rut: '56789012-9', telefono: '+56956789012', email: 'carlos.lopez@email.cl', genero: 'M', estado_civil: 'CASADO', id_congregacion: congregacion.id_congregacion, id_tipo_miembro: tipoMiembroActivo.id_tipo, id_estado: estadoMiembroActivo.id_estado },
        ];

        for (const m of miembros) {
          const exists = await prisma.miembro.findFirst({ where: { rut: m.rut } });
          if (!exists) {
            await prisma.miembro.create({ data: m });
          }
        }
        console.log(`  ✅ ${miembros.length} miembros de prueba`);
      }
    }

    // ===============================
    // RESUMEN
    // ===============================
    console.log('\n=== RESUMEN DE DATOS ===');
    
    const totalTipoMiembro = await prisma.tipoMiembro.count();
    const totalTipoRelacion = await prisma.tipoRelacionFamiliar.count();
    const totalTipoHito = await prisma.tipoHito.count();
    const totalMinisterios = await prisma.ministerio.count();
    const totalMiembros = await prisma.miembro.count();
    
    console.log(`  📋 Tipos de Miembro: ${totalTipoMiembro}`);
    console.log(`  👨‍👩‍👧‍👦 Tipos de Relación: ${totalTipoRelacion}`);
    console.log(`  🎯 Tipos de Hito: ${totalTipoHito}`);
    console.log(`  ⛪ Ministerios: ${totalMinisterios}`);
    console.log(`  👥 Miembros: ${totalMiembros}`);
    
    console.log('\n✅ SEED COMPLETADO EXITOSAMENTE');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();