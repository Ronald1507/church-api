# Documentación de la API - Church Management

## Información General

- **Base URL**: `http://localhost:3000/api`
- **Puerto**: 3000
- **Formato**: JSON

---

## Autenticación

### Iniciar Sesión
```
POST /api/auth/login
```

**Cuerpo de la solicitud:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Respuesta exitosa (200):**
```json
{
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": 5,
    "username": "admin",
    "email": "admin@church.com",
    "role": "USUARIO"
  }
}
```

**Errores:**
- `400`: Usuario y contraseña requeridos
- `401`: Credenciales inválidas
- `500`: Error en el login

---

### Registrarse
```
POST /api/auth/register
```

**Cuerpo de la solicitud:**
```json
{
  "username": "admin",
  "password": "admin123",
  "email": "admin@church.com",
  "id_rol": 1
}
```

**Parámetros:**
- `username` (requerido): Nombre de usuario
- `password` (requerido): Contraseña
- `email` (requerido): Correo electrónico
- `id_rol` (opcional): ID del rol (1=ADMIN, 2=USUARIO)
- `id_miembro` (opcional): ID del miembro asociado

**Respuesta exitosa (201):**
```json
{
  "id": 5,
  "username": "admin",
  "email": "admin@church.com",
  "role": "USUARIO"
}
```

**Errores:**
- `400`: Usuario, contraseña y email requeridos
- `400`: Usuario o email ya existe
- `400`: Rol inválido
- `500`: Error en el registro

---

### Actualizar Token
```
POST /api/auth/refresh
```

**Cuerpo de la solicitud:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Respuesta exitosa (200):**
```json
{
  "token": "eyJhbGc..."
}
```

**Errores:**
- `400`: Token de actualización requerido
- `401`: Token de actualización inválido
- `401`: Usuario no encontrado

---

## Miembros

### Obtener Todos los Miembros
```
GET /api/miembros
```

**Respuesta exitosa (200):**
```json
[
  {
    "id_miembro": 1,
    "nombres": "Juan",
    "apellidos": "Pérez",
    "fecha_nacimiento": "1990-01-15",
    "genero": "M",
    "estado_civil": "SOLTERO",
    "rut": "12345678-9",
    "telefono": "+56912345678",
    "email": "juan@email.com",
    "direccion": "Calle 123",
    "id_estado": 1,
    "id_congregacion": 1,
    "id_tipo_miembro": 1,
    "estado": { ... },
    "congregacion": { ... },
    "tipoMiembro": { ... }
  }
]
```

**Errores:**
- `500`: Error al obtener miembros

---

### Obtener Miembro por ID
```
GET /api/miembros/:id
```

**Parámetros:**
- `id` (requerido): ID del miembro

**Respuesta exitosa (200):**
```json
{
  "id_miembro": 1,
  "nombres": "Juan",
  "apellidos": "Pérez",
  ...
}
```

**Errores:**
- `400`: ID de miembro inválido
- `404`: Miembro no encontrado
- `500`: Error al obtener miembro

---

### Crear Miembro
```
POST /api/miembros
```

**Cuerpo de la solicitud:**
```json
{
  "nombres": "Juan",
  "apellidos": "Pérez",
  "fecha_nacimiento": "1990-01-15",
  "genero": "M",
  "estado_civil": "SOLTERO",
  "rut": "12345678-9",
  "telefono": "+56912345678",
  "email": "juan@email.com",
  "direccion": "Calle 123",
  "id_estado": 1,
  "id_congregacion": 1,
  "id_tipo_miembro": 1
}
```

**Parámetros requeridos:**
- `nombres`
- `apellidos`
- `id_estado`
- `id_congregacion`
- `id_tipo_miembro`

**Respuesta exitosa (201):**
```json
{
  "id_miembro": 1,
  "nombres": "Juan",
  "apellidos": "Pérez",
  ...
}
```

**Errores:**
- `400`: Faltan campos requeridos
- `500`: Error al crear miembro

---

### Actualizar Miembro
```
PUT /api/miembros/:id
```

**Cuerpo de la solicitud:**
```json
{
  "nombres": "Juan",
  "apellidos": "Pérez Actualizado"
}
```

**Errores:**
- `400`: ID de miembro inválido
- `500`: Error al actualizar miembro

---

### Eliminar Miembro
```
DELETE /api/miembros/:id
```

**Errores:**
- `400`: ID de miembro inválido
- `500`: Error al eliminar miembro

**Respuesta exitosa (200):**
```json
{
  "message": "Miembro eliminado correctamente"
}
```

---

### Obtener Tipos de Miembro
```
GET /api/miembros/meta/tipos
```

**Respuesta exitosa (200):**
```json
[
  { "id_tipo": 1, "nombre": "MIEMBRO", "descripcion": "Miembro regular" },
  { "id_tipo": 2, "nombre": "VISITANTE", "descripcion": "Visitante frecuente" },
  { "id_tipo": 3, "nombre": "DISCIPULO", "descripcion": "En proceso de discipulado" }
]
```

---

## Ministerios

### Obtener Todos los Ministerios
```
GET /api/ministerios
```

**Errores:**
- `500`: Error al obtener ministerios

---

### Obtener Ministerio por ID
```
GET /api/ministerios/:id
```

**Errores:**
- `400`: ID inválido
- `404`: Ministerio no encontrado
- `500`: Error al obtener ministerio

---

### Crear Ministerio
```
POST /api/ministerios
```

**Cuerpo de la solicitud:**
```json
{
  "nombre": "Ministerio de Jóvenes",
  "descripcion": "Ministerio para jóvenes de la iglesia",
  "id_lider": 1,
  "id_congregacion": 1,
  "id_estado": 1
}
```

**Parámetros requeridos:**
- `nombre`
- `id_congregacion`
- `id_estado`

**Errores:**
- `400`: Faltan campos requeridos
- `500`: Error al crear ministry

---

### Actualizar Ministerio
```
PUT /api/ministerios/:id
```

**Errores:**
- `400`: ID inválido
- `500`: Error al actualizar ministry

---

### Eliminar Ministerio
```
DELETE /api/ministerios/:id
```

**Errores:**
- `400`: ID inválido
- `500`: Error al eliminar ministry

**Respuesta exitosa (200):**
```json
{
  "message": "Ministerio eliminado correctamente"
}
```

---

## Congregaciones

### Obtener Todas las Congregaciones
```
GET /api/congregaciones
```

**Errores:**
- `500`: Error al obtener congregaciones

---

### Obtener Congregación por ID
```
GET /api/congregaciones/:id
```

**Errores:**
- `400`: ID inválido
- `404`: Congregación no encontrada
- `500`: Error al obtener congregación

---

### Crear Congregación
```
POST /api/congregaciones
```

**Cuerpo de la solicitud:**
```json
{
  "nombre": "Iglesia Central",
  "direccion": "Av. Principal 123",
  "ciudad": "Santiago",
  "region": "Metropolitana",
  "telefono": "+5622123456",
  "email": "iglesia@email.com",
  "id_estado": 1
}
```

**Parámetros requeridos:**
- `nombre`
- `id_estado`

**Errores:**
- `400`: Faltan campos requeridos
- `500`: Error al crear congregación

---

### Actualizar Congregación
```
PUT /api/congregaciones/:id
```

**Errores:**
- `400`: ID inválido
- `500`: Error al actualizar congregación

---

### Eliminar Congregación
```
DELETE /api/congregaciones/:id
```

**Errores:**
- `400`: ID inválido
- `500`: Error al eliminar congregación

**Respuesta exitosa (200):**
```json
{
  "message": "Congregación eliminada correctamente"
}
```

---

## Health Check

### Verificar Estado del Servidor
```
GET /health
```

**Respuesta exitosa (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-27T05:36:36.370Z"
}
```

---

## Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Solicitud inválida |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

---

## Autenticación con Token JWT

Para endpoints protegidos, incluir el token en el header:

```
Authorization: Bearer <token>
```

**Errores de autenticación:**
- `401`: Token de acceso requerido
- `403`: Token inválido o expirado
- `401`: No autenticado
- `403`: Permisos insuficientes
