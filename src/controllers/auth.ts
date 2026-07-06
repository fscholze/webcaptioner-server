import { Request, Response, NextFunction } from 'express'
import { isUserAdmin } from '../helper/auth'
import {
  createKeycloakUser,
  getKeycloakUsers,
  loginWithPassword,
  refreshUserToken,
  sendPasswordResetEmail,
} from '../helper/keycloak'

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  try {
    const tokens = await loginWithPassword(email, password)
    return res.json({
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    })
  } catch (error) {
    if ((error as Error).message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }
    return res.status(500).json({ message: (error as Error).message })
  }
}

export const register = async (req: Request, res: Response) => {
  const { firstname, lastname, email, password } = req.body

  if (!firstname || !lastname) {
    return res.status(400).json({
      message: 'First name and last name are required.',
    })
  }
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' })
  }
  if (!password) {
    return res.status(400).json({ message: 'Password is required.' })
  }

  try {
    await createKeycloakUser({ firstname, lastname, email, password })
    return res.json({ message: 'Registration successful' })
  } catch (error) {
    if ((error as Error).message === 'EMAIL_ALREADY_IN_USE') {
      return res
        .status(409)
        .json({ message: 'This email address is already in use.' })
    }
    return res.status(500).json({ message: (error as Error).message })
  }
}

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' })
  }

  try {
    await sendPasswordResetEmail(email)
  } catch {
    // Always return success to avoid email enumeration
  }

  return res.json({
    message:
      'If an account with this email exists, a password reset link has been sent.',
  })
}

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body

  if (!token) {
    return res.status(400).json({ message: 'Refresh token is required.' })
  }

  try {
    const tokens = await refreshUserToken(token)
    return res.json({
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    })
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token.' })
  }
}

export const loginFree = async (req: Request, res: Response) => {
  try {
    const { password } = req.body

    const passwordMatch = password === process.env.FREE_PASSWORD
    if (!passwordMatch) {
      return res.status(401).send()
    }

    return res.status(200).send()
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
  }
}

export const IsUserAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { authorization } = req.headers
  if (!authorization) return res.status(403).json({ message: 'Invalid token' })

  const isAdmin = await isUserAdmin(authorization as string)
  if (isAdmin) return next()

  return res.status(403).json({ message: 'Forbidden' })
}

export const listKeycloakUsers = async (_req: Request, res: Response) => {
  try {
    const users = await getKeycloakUsers()
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: (error as Error).message })
  }
}
