import { User } from '../models/user'
import bcrypt from 'bcrypt'
import { Request, Response, NextFunction } from 'express'
import { createToken, hashPassword, isUser, isUserAdmin } from '../helper/auth'

export const register = async (req: Request, res: Response) => {
  const { firstname, lastname, email, password } = req.body

  if (!firstname || !lastname) {
    return res.status(400).send({
      statusCode: 400,
      message: 'You must provide a username to create an account.',
    })
  } else if (!email) {
    return res.status(400).send({
      statusCode: 400,
      message: 'You must provide an email address to create an account.',
    })
  } else if (!password) {
    return res.status(400).send({
      statusCode: 400,
      message: 'You must provide a password to create an account.',
    })
  }

  const checkEmail = await User.findOne({ email })
  if (checkEmail) {
    return res.status(409).send({
      statusCode: 409,
      message: 'This email address is already in use.',
    })
  }
  await User.create({
    firstname,
    lastname,
    email,
    password: await hashPassword(password),
  })

  res.json({ message: 'Registration successful' })
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
      .select('_id password role')
      .exec()

    if (!user) {
      return res.status(401).send()
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).send()
    }

    const token = createToken({ email, id: user._id, role: user.role })
    res.json({ token })
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
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
  next: NextFunction
) => {
  const { token } = req.headers
  if (!token) res.status(403).json({ message: 'Invalid token' })
  const isAdmin = isUserAdmin(token as string)
  if (isAdmin) next()
  else res.status(403)
}
