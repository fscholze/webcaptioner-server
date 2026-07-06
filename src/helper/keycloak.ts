import axios from 'axios'
import jwksClient from 'jwks-rsa'
import jwt from 'jsonwebtoken'

export interface KeycloakTokenPayload {
  sub: string
  email?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  realm_access?: { roles?: string[] }
}

const getKeycloakUrl = () => process.env.KEYCLOAK_URL?.replace(/\/$/, '') ?? ''
const getRealm = () => process.env.KEYCLOAK_REALM ?? ''
const getIssuer = () => `${getKeycloakUrl()}/realms/${getRealm()}`

let jwks: ReturnType<typeof jwksClient> | null = null

const getJwksClient = () => {
  if (!jwks) {
    jwks = jwksClient({
      jwksUri: `${getIssuer()}/protocol/openid-connect/certs`,
      cache: true,
      rateLimit: true,
    })
  }
  return jwks
}

const getSigningKey = (kid: string): Promise<string> =>
  new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error('Signing key not found'))
        return
      }
      resolve(key.getPublicKey())
    })
  })

export const verifyKeycloakToken = async (
  token: string,
): Promise<KeycloakTokenPayload | null> => {
  if (!getKeycloakUrl() || !getRealm()) return null

  try {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      return null
    }

    const signingKey = await getSigningKey(decoded.header.kid)
    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: getIssuer(),
    }) as KeycloakTokenPayload

    return verified
  } catch {
    return null
  }
}

let cachedServiceToken: { token: string; expiresAt: number } | null = null

export const getServiceAccountToken = async (): Promise<string> => {
  const now = Date.now()
  if (cachedServiceToken && cachedServiceToken.expiresAt > now + 30_000) {
    return cachedServiceToken.token
  }

  const clientId = process.env.KEYCLOAK_SERVICE_ACCOUNT_CLIENT_ID
  const clientSecret = process.env.KEYCLOAK_SERVICE_ACCOUNT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Keycloak service account credentials are not configured')
  }

  const response = await axios.post(
    `${getIssuer()}/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )

  const { access_token, expires_in } = response.data
  cachedServiceToken = {
    token: access_token,
    expiresAt: now + expires_in * 1000,
  }

  return access_token
}

export interface CreateKeycloakUserInput {
  email: string
  firstname: string
  lastname: string
  password: string
}

export const createKeycloakUser = async (input: CreateKeycloakUserInput) => {
  const token = await getServiceAccountToken()
  const username = input.email

  try {
    await axios.post(
      `${getKeycloakUrl()}/admin/realms/${getRealm()}/users`,
      {
        username,
        email: input.email,
        firstName: input.firstname,
        lastName: input.lastname,
        enabled: true,
        emailVerified: false,
        credentials: [
          {
            type: 'password',
            value: input.password,
            temporary: false,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      throw new Error('EMAIL_ALREADY_IN_USE')
    }
    throw error
  }
}

export interface KeycloakTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export const loginWithPassword = async (
  username: string,
  password: string,
): Promise<KeycloakTokenResponse> => {
  const clientId = process.env.KEYCLOAK_CLIENT_ID
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Keycloak client credentials are not configured')
  }

  try {
    const response = await axios.post(
      `${getIssuer()}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        scope: 'openid profile email',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error('INVALID_CREDENTIALS')
    }
    throw error
  }
}

export const refreshUserToken = async (
  refreshToken: string,
): Promise<KeycloakTokenResponse> => {
  const clientId = process.env.KEYCLOAK_CLIENT_ID
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Keycloak client credentials are not configured')
  }

  const response = await axios.post(
    `${getIssuer()}/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
    expires_in: response.data.expires_in,
  }
}

export const findKeycloakUserByEmail = async (email: string) => {
  const token = await getServiceAccountToken()

  const response = await axios.get(
    `${getKeycloakUrl()}/admin/realms/${getRealm()}/users`,
    {
      params: { email, exact: true },
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  return response.data[0] ?? null
}

export const sendPasswordResetEmail = async (email: string) => {
  const user = await findKeycloakUserByEmail(email)
  if (!user?.id) return

  const serviceToken = await getServiceAccountToken()
  const clientId = process.env.KEYCLOAK_CLIENT_ID ?? ''

  await axios.put(
    `${getKeycloakUrl()}/admin/realms/${getRealm()}/users/${user.id}/execute-actions-email`,
    ['UPDATE_PASSWORD'],
    {
      params: { client_id: clientId },
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
      },
    },
  )
}

export const getKeycloakUsers = async () => {
  const token = await getServiceAccountToken()

  const response = await axios.get(
    `${getKeycloakUrl()}/admin/realms/${getRealm()}/users`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  return response.data
}
