import { User } from '../models/user'
import { Request, Response } from 'express'
import { verifyAuthToken } from '../helper/auth'
import { findOrCreateUserFromToken } from '../helper/user-sync'

export const getMe = async (req: Request, res: Response) => {
  const { authorization } = req.headers

  if (!authorization) return res.status(403).json({ message: 'Invalid token' })

  const verifiedToken = await verifyAuthToken(authorization as string)

  if (!verifiedToken) {
    return res.status(403).json({ message: 'Invalid token' })
  }

  const user = await findOrCreateUserFromToken(verifiedToken)

  if (!user) return res.status(403).json({ message: 'Invalid token' })

  return res.send(user)
}
