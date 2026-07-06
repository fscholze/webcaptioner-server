import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { IUser, UserRole } from '../models/user'
import { Types } from 'mongoose'
import { verifyKeycloakToken } from './keycloak'

export const hashPassword = (password: string) => {
  return bcrypt.hash(password, 16)
}

export const createToken = (payload: {
  email: string
  id: Types.ObjectId
  role: IUser['role']
}) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY!, {
    expiresIn: '24 hour',
  })

  return token
}

export const verifyPassword = (password: string, existingPassword: string) => {
  return bcrypt.compare(password, existingPassword)
}

export interface AuthTokenPayload {
  email: string
  id?: Types.ObjectId
  keycloakId?: string
  role: IUser['role']
  firstname?: string
  lastname?: string
}

const getRoleFromKeycloakRoles = (roles: string[] = []): IUser['role'] => {
  const adminRole = process.env.KEYCLOAK_ADMIN_ROLE ?? 'admin'
  return roles.includes(adminRole) ? UserRole.ADMIN : UserRole.USER
}

export const verifyAuthToken = async (
  authorization: string,
): Promise<AuthTokenPayload | null> => {
  const cleanedToken = authorization.replace('Bearer ', '').trim()

  const keycloakPayload = await verifyKeycloakToken(cleanedToken)
  if (keycloakPayload?.sub) {
    return {
      email: keycloakPayload.email ?? keycloakPayload.preferred_username ?? '',
      keycloakId: keycloakPayload.sub,
      firstname: keycloakPayload.given_name,
      lastname: keycloakPayload.family_name,
      role: getRoleFromKeycloakRoles(keycloakPayload.realm_access?.roles),
    }
  }

  try {
    const decoded = jwt.verify(
      cleanedToken,
      process.env.JWT_SECRET_KEY!,
    ) as AuthTokenPayload
    return decoded
  } catch {
    return null
  }
}

/** @deprecated Use verifyAuthToken instead */
export const verifyToken = (token: string) => {
  const cleanedToken = token.replace('Bearer ', '').trim()
  return jwt.decode(cleanedToken) as {
    email: string
    id: Types.ObjectId
    role: IUser['role']
  }
}

export const isUserAdmin = async (authorization: string) => {
  const userPayload = await verifyAuthToken(authorization)
  return userPayload?.role === UserRole.ADMIN
}

export const isUser = async (authorization: string) => {
  const user = await verifyAuthToken(authorization)
  return Boolean(user)
}
