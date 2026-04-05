import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { authenticateToken, AuthRequest, getCongregacionFilter } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { getEstadoByCodigo } from '../utils/estados';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Helper to get numeric ID from any param
const getNumericId = (param: string | string[]): number | null => {
  const value = Array.isArray(param) ? param[0] : param;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
};

// ==================== OPCIONES - MUST BE BEFORE OTHER ROUTES ====================

// Get options for finance forms
router.get('/opciones', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    
    // Si no es admin, solo puede ver su congregación
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionFilter = { id_congregacion: req.user.id_congregacion };
    }

    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({
        where: { entidad: 'TRANSACCION' },
        orderBy: { nombre: 'asc' }
      }),
      prisma.congregacion.findMany({
        where: congregacionFilter,
        include: { estado: true },
        orderBy: { nombre: 'asc' }
      })
    ]);
    res.json({ estados, congregaciones });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Error al obtener metadatos' });
  }
});

// ==================== CUENTAS ====================

// Get all cuentas - filtrado por congregación
router.get('/cuentas', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const cuentas = await prisma.finanzaCuenta.findMany({
      where: congregacionFilter,
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(cuentas);
  } catch (error) {
    console.error('Error getting cuentas:', error);
    res.status(500).json({ error: 'Error al obtener cuentas' });
  }
});

// Get cuentas by estado - dinámico
router.get('/cuentas/estado/:idEstado', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) {
      return res.status(400).json({ error: 'ID de estado inválido' });
    }
    
    // Validar que el estado pertenece a la entidad FINANZA_CUENTA
    const estado = await prisma.estado.findUnique({
      where: { id_estado: idEstado }
    });
    
    if (!estado) {
      return res.status(404).json({ error: 'Estado no encontrado' });
    }
    
    if (estado.entidad !== 'FINANZA_CUENTA') {
      return res.status(400).json({ error: `El estado ${idEstado} no pertenece a la entidad FINANZA_CUENTA` });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const cuentas = await prisma.finanzaCuenta.findMany({
      where: {
        ...congregacionFilter,
        id_estado: idEstado
      },
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(cuentas);
  } catch (error) {
    console.error('Error getting cuentas by estado:', error);
    res.status(500).json({ error: 'Error al obtener cuentas' });
  }
});

// Get cuenta by ID - filtrado por congregación
router.get('/cuentas/:id', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const cuenta = await prisma.finanzaCuenta.findFirst({
      where: {
        id_cuenta: id,
        ...congregacionFilter
      },
      include: {
        congregacion: true,
        estado: true,
        transacciones: {
          orderBy: { fecha: 'desc' },
          take: 50
        }
      }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    res.json(cuenta);
  } catch (error) {
    console.error('Error getting cuenta:', error);
    res.status(500).json({ error: 'Error al obtener cuenta' });
  }
});

// Create cuenta
router.post('/cuentas', authenticateToken, requirePermission('finanzas', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, saldo_actual, id_congregacion, id_estado } = req.body;

    if (!nombre || !tipo || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Si no es admin, forzar la congregación del usuario
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionId = req.user.id_congregacion;
    }

    if (!congregacionId) {
      return res.status(400).json({ error: 'Debe especificar una congregación' });
    }

    const newCuenta = await prisma.finanzaCuenta.create({
      data: {
        nombre,
        tipo,
        descripcion,
        saldo_actual: saldo_actual || 0,
        id_congregacion: congregacionId,
        id_estado
      },
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.status(201).json(newCuenta);
  } catch (error) {
    console.error('Error creating cuenta:', error);
    res.status(500).json({ error: 'Error al crear cuenta' });
  }
});

// Update cuenta
router.put('/cuentas/:id', authenticateToken, requirePermission('finanzas', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que la cuenta pertenezca a la congregación del usuario
    const existingCuenta = await prisma.finanzaCuenta.findFirst({
      where: {
        id_cuenta: id,
        ...congregacionFilter
      }
    });

    if (!existingCuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_cuenta;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Si no es admin, no permitir cambiar la congregación ni el saldo
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN') {
      delete updateData.id_congregacion;
      delete updateData.saldo_actual;
    }

    const updatedCuenta = await prisma.finanzaCuenta.update({
      where: { id_cuenta: id },
      data: updateData,
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.json(updatedCuenta);
  } catch (error) {
    console.error('Error updating cuenta:', error);
    res.status(500).json({ error: 'Error al actualizar cuenta' });
  }
});

// Delete cuenta (eliminación lógica)
router.delete('/cuentas/:id', authenticateToken, requirePermission('finanzas', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que la cuenta pertenezca a la congregación del usuario
    const existingCuenta = await prisma.finanzaCuenta.findFirst({
      where: {
        id_cuenta: id,
        ...congregacionFilter
      }
    });

    if (!existingCuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    // Eliminación lógica: buscar estado por código
    const estadoInactiva = await getEstadoByCodigo('FINANZA_CUENTA', 'INACTIVA');
    if (!estadoInactiva) {
      return res.status(500).json({ error: "Estado 'INACTIVA' no encontrado en la base de datos" });
    }

    await prisma.finanzaCuenta.update({
      where: { id_cuenta: id },
      data: { id_estado: estadoInactiva.id_estado }
    });

    res.json({ message: 'Cuenta eliminada (inactiva)' });
  } catch (error) {
    console.error('Error deleting cuenta:', error);
    res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

// ==================== TRANSACCIONES ====================

// Get all transacciones - filtrado por congregación
router.get('/transacciones', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const transacciones = await prisma.transaccion.findMany({
      where: {
        cuenta: congregacionFilter
      },
      include: {
        cuenta: true,
        estado: true
      },
      orderBy: { fecha: 'desc' }
    });
    res.json(transacciones);
  } catch (error) {
    console.error('Error getting transacciones:', error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

// Get transacciones by cuenta - filtrado por congregación
router.get('/cuentas/:id/transacciones', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const transacciones = await prisma.transaccion.findMany({
      where: {
        id_cuenta: id,
        cuenta: congregacionFilter
      },
      include: {
        cuenta: true,
        estado: true
      },
      orderBy: { fecha: 'desc' }
    });
    res.json(transacciones);
  } catch (error) {
    console.error('Error getting transacciones:', error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

// Create transaccion
router.post('/transacciones', authenticateToken, requirePermission('finanzas', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { id_cuenta, tipo, concepto, monto, fecha, metodo_pago, id_registrado_por, id_estado } = req.body;

    if (!id_cuenta || !tipo || !concepto || !monto || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar que la cuenta pertenezca a la congregación del usuario
    const congregacionFilter = getCongregacionFilter(req.user);
    const cuenta = await prisma.finanzaCuenta.findFirst({
      where: {
        id_cuenta: parseInt(id_cuenta),
        ...congregacionFilter
      }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const newTransaccion = await prisma.transaccion.create({
      data: {
        id_cuenta: parseInt(id_cuenta),
        tipo,
        concepto,
        monto: parseFloat(monto),
        fecha: fecha ? new Date(fecha) : new Date(),
        metodo_pago,
        id_registrado_por: id_registrado_por ? parseInt(id_registrado_por) : (req.user?.userId ?? 0),
        id_estado
      },
      include: {
        cuenta: true,
        estado: true
      }
    });

    // Update saldo de la cuenta
    const nuevoSaldo = tipo === 'ingreso' 
      ? parseFloat(cuenta.saldo_actual.toString()) + parseFloat(monto)
      : parseFloat(cuenta.saldo_actual.toString()) - parseFloat(monto);
    
    await prisma.finanzaCuenta.update({
      where: { id_cuenta: parseInt(id_cuenta) },
      data: { saldo_actual: nuevoSaldo }
    });

    res.status(201).json(newTransaccion);
  } catch (error) {
    console.error('Error creating transaccion:', error);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// Delete transaccion (eliminación lógica)
router.delete('/transacciones/:id', authenticateToken, requirePermission('finanzas', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);

    // Get transaccion first to verify access
    const transaccion = await prisma.transaccion.findFirst({
      where: {
        id_transaccion: id,
        cuenta: congregacionFilter
      },
      include: { cuenta: true }
    });

    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }
    
    // Eliminación lógica: buscar estado por código
    const estadoCancelada = await getEstadoByCodigo('TRANSACCION', 'CANCELADA');
    if (!estadoCancelada) {
      return res.status(500).json({ error: "Estado 'CANCELADA' no encontrado en la base de datos" });
    }

    await prisma.transaccion.update({
      where: { id_transaccion: id },
      data: { id_estado: estadoCancelada.id_estado }
    });

    res.json({ message: 'Transacción eliminada (cancelada)' });
  } catch (error) {
    console.error('Error deleting transaccion:', error);
    res.status(500).json({ error: 'Error al eliminar transacción' });
  }
});

export default router;