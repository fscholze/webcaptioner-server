import { User } from '../models/user'
import { Request, Response } from 'express'
import { verifyToken } from '../helper/auth'
import { AudioRecord } from '../models/audio-record'
import { record } from 'zod'
import dayjs from 'dayjs'

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

export const getAudioCast = async (req: Request, res: Response) => {
  const { token } = req.params

  if (token) {
    const audioRecords = await AudioRecord.findOne({
      token,
    })
      .select('-owner')
      .exec()

    if (!audioRecords) return res.status(400).json({ message: 'Wrong token' })
    return res.send(audioRecords)
  }
  res.status(400).json({ message: 'Wrong token' })
}

export const createAudioRecord = async (req: Request, res: Response) => {
  const { authorization } = req.headers
  const { originalText, translatedText, speakerId } = req.body as {
    originalText: string[]
    translatedText: string[]
    speakerId: string | null
  }

  if (authorization) {
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
    } else {
      return res.status(403).json({ message: 'Invalid token' })
    }
  } else {
    const audioRecord = await AudioRecord.create({
      title: dayjs().format('YYYY-MM-DD HH:mm'),
      originalText,
      translatedText,
      speakerId,
    })

    return res.status(203).send(audioRecord)
    return res.status(403).json({ message: 'Invalid token' })
  }
}

export const updateAudioRecord = async (req: Request, res: Response) => {
  // const { authorization } = req.headers
  const { id: recordId } = req.params
  const { speakerId } = req.body as { speakerId: string | null }

  // if (!authorization) return res.status(403).json({ message: 'Invalid token' })
  // if (!speakerId) return res.status(400).json({ message: 'Missing params' })

  // const verifiedToken = verifyToken(authorization as string)

  if (recordId) {
    const audioRecord = await AudioRecord.findOneAndUpdate(
      {
        _id: recordId,
      },
      { speakerId }
    ).exec()
    if (!audioRecord)
      return res.status(400).json({ message: 'No Record found' })

    return res.send(audioRecord)
  }
  // if (verifiedToken?.id) {
  //   const audioRecord = await AudioRecord.findOneAndUpdate(
  //     {
  //       _id: recordId,
  //       owner: verifiedToken.id,
  //     },
  //     { speakerId }
  //   ).exec()

  //   if (!audioRecord)
  //     return res.status(400).json({ message: 'No Record found' })

  //   return res.send(audioRecord)
  // }
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
