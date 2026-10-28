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

export const isKeycloakConfigured = () =>
  Boolean(
    process.env.KEYCLOAK_URL &&
      process.env.KEYCLOAK_REALM &&
      process.env.KEYCLOAK_CLIENT_ID &&
      process.env.KEYCLOAK_CLIENT_SECRET,
  )

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

export interface KeycloakTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  id_token?: string
}

export const getKeycloakPublicConfig = () => {
  if (!isKeycloakConfigured()) {
    return { enabled: false as const }
  }

  return {
    enabled: true as const,
    authorizationEndpoint: `${getIssuer()}/protocol/openid-connect/auth`,
    logoutEndpoint: `${getIssuer()}/protocol/openid-connect/logout`,
    clientId: process.env.KEYCLOAK_CLIENT_ID as string,
    scope: 'openid profile email',
  }
}

export const isAllowedCallbackUri = (redirectUri: string) => {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return false
  }

  if (url.pathname !== '/authentication/callback') return false
  if (url.username || url.password || url.search || url.hash) return false
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const allowed = (process.env.KEYCLOAK_REDIRECT_URIS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  if (allowed.length === 0) return true

  return allowed.includes(`${url.origin}${url.pathname}`)
}

const requestToken = async (
  params: Record<string, string>,
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
        client_id: clientId,
        client_secret: clientSecret,
        ...params,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      id_token: response.data.id_token,
    }
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 400 || error.response?.status === 401)
    ) {
      throw new Error('INVALID_TOKEN_REQUEST')
    }
    throw error
  }
}

export const exchangeAuthorizationCode = (
  code: string,
  redirectUri: string,
  codeVerifier: string,
) =>
  requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

export const refreshUserToken = (refreshToken: string) =>
  requestToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
