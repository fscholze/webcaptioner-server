import { User } from '../models/user'
import { Request, Response } from 'express'
import { verifyToken } from '../helper/auth'
import { AudioRecord } from '../models/audio-record'
import { record } from 'zod'
import dayjs from 'dayjs'

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

export const getAudioRecords = async (req: Request, res: Response) => {
  const { authorization } = req.headers

  if (!authorization) return res.status(403).json({ message: 'Invalid token' })

  const verifiedToken = verifyToken(authorization as string)

  if (verifiedToken?.id) {
    const audioRecords = await AudioRecord.find({
      owner: verifiedToken.id,
    }).exec()

    if (!audioRecords) return res.status(403).json({ message: 'Invalid token' })
    return res.send(audioRecords)
  }
  res.status(403).json({ message: 'Invalid token' })
}

export const createAudioRecord = async (req: Request, res: Response) => {
  const { authorization } = req.headers
  const { originalText, translatedText } = req.body as {
    originalText: string[]
    translatedText: string[]
  }

  if (!authorization) return res.status(403).json({ message: 'Invalid token' })
  if (!originalText || !translatedText)
    return res.status(400).json({ message: 'Missing params' })

  const verifiedToken = verifyToken(authorization as string)

  if (verifiedToken?.id) {
    const audioRecord = await AudioRecord.create({
      title: dayjs().format('YYYY-MM-DD HH:mm'),
      originalText,
      translatedText,
      owner: verifiedToken.id,
    })

    return res.status(203).send(audioRecord)
  }
  res.status(403).json({ message: 'Invalid token' })
}

// export const updateAudioRecord = async (req: Request, res: Response) => {
//   const { authorization } = req.headers
//   const { recordId } = req.params

//   if (!authorization) return res.status(403).json({ message: 'Invalid token' })
//   if (!recordId) return res.status(400).json({ message: 'Missing params' })

//   const verifiedToken = verifyToken(authorization as string)

//   if (verifiedToken?.id) {
//     const audioRecord = await AudioRecord.findOne({
//       _id: recordId,
//       user: verifiedToken.id,
//     }).exec()
//     if (!audioRecord)
//       return res.status(400).json({ message: 'No Record found' })

//     return res.send(user.audioRecords)
//   }
//   res.status(403).json({ message: 'Invalid token' })
// }
