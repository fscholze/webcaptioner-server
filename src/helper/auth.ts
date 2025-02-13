import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { IUser } from '../models/user'
import { Types } from 'mongoose'

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

export const verifyToken = (token: string) => {
  const cleanedToken = token.replace('Bearer ', '').trim()
  return jwt.decode(cleanedToken) as {
    email: string
    id: Types.ObjectId
    role: IUser['role']
  }
}

export const isUserAdmin = (token: string) => {
  const userPayload = verifyToken(token)
  return userPayload?.role === 'ADMIN'
}

export const isUser = (token: string) => {
  const user = verifyToken(token)
  if (user) return true
  return false
}
