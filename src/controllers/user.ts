import { User } from '../models/user'
import { Request, Response } from 'express'
import { verifyToken } from '../helper/auth'

export const getMe = async (req: Request, res: Response) => {
  const { authorization } = req.headers

  if (!authorization) return res.status(403).json({ message: 'Invalid token' })

  const verifiedToken = verifyToken(authorization as string)

  if (verifiedToken?.id) {
    const user = await User.findOne({ _id: verifiedToken.id })
      .select('-audioRecords')
      .exec()
    if (!user) return res.status(403).json({ message: 'Invalid token' })

    return res.send(user)
  }
  res.status(403).json({ message: 'Invalid token' })
}
