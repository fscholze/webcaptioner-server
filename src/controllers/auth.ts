import { Request, Response } from 'express'
import { User } from '../models/user'
import { createToken, verifyPassword } from '../helper/auth'
import {
  endKeycloakSession,
  exchangeAuthorizationCode,
  getKeycloakPublicConfig,
  buildKeycloakLogoutUrl,
  isAllowedCallbackUri,
  isKeycloakConfigured,
  refreshUserToken,
  verifyKeycloakToken,
} from '../helper/keycloak'

const loginWithDatabase = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select('_id password role').exec()

  if (!user?.password) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const passwordMatch = await verifyPassword(password, user.password)
  if (!passwordMatch) {
    throw new Error('INVALID_CREDENTIALS')
  }

  return createToken({ email, id: user._id, role: user.role })
}

export const getKeycloakConfig = (_req: Request, res: Response) => {
  return res.json(getKeycloakPublicConfig())
}

export const keycloakCallback = async (req: Request, res: Response) => {
  if (!isKeycloakConfigured()) {
    return res.status(400).json({ message: 'Keycloak is not configured.' })
  }

  const { code, redirectUri, codeVerifier } = req.body ?? {}

  if (
    typeof code !== 'string' ||
    typeof redirectUri !== 'string' ||
    typeof codeVerifier !== 'string' ||
    code.length === 0 ||
    code.length > 2048
  ) {
    return res.status(400).json({ message: 'Invalid login callback.' })
  }

  if (!isAllowedCallbackUri(redirectUri)) {
    return res.status(400).json({ message: 'Invalid redirect URI.' })
  }

  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) {
    return res.status(400).json({ message: 'Invalid code verifier.' })
  }

  try {
    const tokens = await exchangeAuthorizationCode(
      code,
      redirectUri,
      codeVerifier,
    )
    const verified = await verifyKeycloakToken(tokens.access_token)
    if (!verified) {
      await endKeycloakSession(tokens.refresh_token)
      const loginPage = new URL(redirectUri)
      loginPage.pathname = '/authentication/login'
      loginPage.search = ''
      loginPage.hash = ''
      const group = process.env.KEYCLOAK_REQUIRED_GROUP?.trim() || 'webcaptioner'
      return res.status(403).json({
        message: `Du bist nicht in der Gruppe ${group}.`,
        logoutUrl: buildKeycloakLogoutUrl(
          `${loginPage.origin}${loginPage.pathname}`,
          tokens.id_token,
        ),
      })
    }
    return res.json({
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      idToken: tokens.id_token,
    })
  } catch (error) {
    if ((error as Error).message === 'INVALID_TOKEN_REQUEST') {
      return res.status(401).json({ message: 'Login failed.' })
    }
    return res.status(500).json({ message: 'Login failed.' })
  }
}

export const login = async (req: Request, res: Response) => {
  if (isKeycloakConfigured()) {
    return res.status(400).json({
      message: 'Sign in through the Keycloak login page.',
    })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  try {
    const token = await loginWithDatabase(email, password)
    return res.json({ token })
  } catch (error) {
    if ((error as Error).message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }
    return res.status(500).json({ message: (error as Error).message })
  }
}

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body

  if (!token) {
    return res.status(400).json({ message: 'Refresh token is required.' })
  }

  if (!isKeycloakConfigured()) {
    return res.status(401).json({ message: 'Invalid refresh token.' })
  }

  try {
    const tokens = await refreshUserToken(token)
    return res.json({
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      idToken: tokens.id_token,
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
