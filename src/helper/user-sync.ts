import { User, UserRole } from '../models/user'
import { AuthTokenPayload, verifyAuthToken } from './auth'

export const findOrCreateUserFromToken = async (payload: AuthTokenPayload) => {
  const { keycloakId, email, firstname, lastname, role } = payload

  if (keycloakId) {
    let user = await User.findOne({
      $or: [{ keycloakId }, ...(email ? [{ email }] : [])],
    }).exec()

    if (!user && email) {
      user = await User.create({
        keycloakId,
        email,
        firstname: firstname ?? '',
        lastname: lastname ?? '',
        role: role ?? UserRole.USER,
      })
      return user
    }

    if (user) {
      const updates: Record<string, string> = {}
      if (!user.keycloakId) updates.keycloakId = keycloakId
      if (firstname && user.firstname !== firstname) updates.firstname = firstname
      if (lastname && user.lastname !== lastname) updates.lastname = lastname
      if (role === UserRole.ADMIN && user.role !== UserRole.ADMIN) {
        updates.role = UserRole.ADMIN
      }

      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, updates, {
          new: true,
        }).exec()
      }
      return user
    }
  }

  if (payload.id) {
    return User.findById(payload.id).select('-audioRecords').exec()
  }

  if (email) {
    return User.findOne({ email }).select('-audioRecords').exec()
  }

  return null
}

export const resolveUserIdFromAuth = async (authorization: string) => {
  const payload = await verifyAuthToken(authorization)
  if (!payload) return null

  const user = await findOrCreateUserFromToken(payload)
  return user?._id ?? null
}
