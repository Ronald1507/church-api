// Script para crear usuario admin inicial
// Uso: node create-admin.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Verificando datos existentes...');

    // Verificar si ya existe el usuario admin
    const existingAdmin = await prisma.usuarioSistema.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('✅ El usuario admin ya existe');
      return;
    }

    // Obtener rol ADMIN
    const adminRole = await prisma.rolSistema.findUnique({
      where: { nombre: 'ADMIN' }
    });

    if (!adminRole) {
      console.log('❌ No existe el rol ADMIN. Ejecuta primero el seed completo.');
      return;
    }

    // Obtener estado ACTIVO para usuario
    const activoEstado = await prisma.estado.findFirst({
      where: { entidad: 'USUARIO', codigo: 'ACTIVO' }
    });

    if (!activoEstado) {
      console.log('❌ No existe el estado ACTIVO para usuarios. Ejecuta primero el seed completo.');
      return;
    }

    // Crear usuario admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.usuarioSistema.create({
      data: {
        username: 'admin',
        email: 'admin@iglesia.cl',
        password_hash: hashedPassword,
        id_rol: adminRole.id_rol,
        id_estado: activoEstado.id_estado
      }
    });

    console.log(`✅ Usuario admin creado exitosamente!`);
    console.log(`   Username: admin`);
    console.log(`   Password: admin123`);
    console.log(`   Email: admin@iglesia.cl`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
