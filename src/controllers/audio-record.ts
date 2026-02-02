import { User } from '../models/user'
import { Request, Response } from 'express'
import { verifyToken } from '../helper/auth'
import { AudioRecord } from '../models/audio-record'
import { record } from 'zod'
import dayjs from 'dayjs'

export const getAudioRecords = async (req: Request, res: Response) => {
  const { authorization } = req.headers

  const parsePositiveInt = (value: unknown): number | undefined => {
    if (value === undefined || value === null) return undefined
    if (Array.isArray(value)) return parsePositiveInt(value[0])
    const parsed = Number.parseInt(String(value), 10)
    if (Number.isNaN(parsed)) return undefined
    return parsed
  }

  if (!authorization) return res.status(403).json({ message: 'Invalid token' })

  const verifiedToken = verifyToken(authorization as string)

  if (verifiedToken?.id) {
    const pageRaw = parsePositiveInt(req.query.page)
    const limitRaw = parsePositiveInt(req.query.limit)

    const hasPagination = pageRaw !== undefined || limitRaw !== undefined
    const page = Math.max(0, pageRaw ?? 0)
    const limit = Math.min(100, Math.max(1, limitRaw ?? 25))

    const baseQuery = {
      owner: verifiedToken.id,
    }

    if (!hasPagination) {
      const audioRecords = await AudioRecord.find(baseQuery)
        .sort({ createdAt: -1, _id: -1 })
        .exec()

      if (!audioRecords)
        return res.status(403).json({ message: 'Invalid token' })
      return res.send(audioRecords)
    }

    const [items, total] = await Promise.all([
      AudioRecord.find(baseQuery)
        .sort({ createdAt: -1, _id: -1 })
        .skip(page * limit)
        .limit(limit)
        .exec(),
      AudioRecord.countDocuments(baseQuery).exec(),
    ])

    return res.send({ items, total, page, limit })
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

  const safeOriginalText = Array.isArray(originalText) ? originalText : []
  const safeTranslatedText = Array.isArray(translatedText) ? translatedText : []

  if (authorization) {
    const verifiedToken = verifyToken(authorization as string)

    if (verifiedToken?.id) {
      const audioRecord = await AudioRecord.create({
        title: dayjs().format('YYYY-MM-DD HH:mm'),
        originalText: safeOriginalText,
        translatedText: safeTranslatedText,
        owner: verifiedToken.id,
        speakerId,
      })

      return res.status(203).send(audioRecord)
    } else {
      return res.status(403).json({ message: 'Invalid token' })
    }
  } else {
    const audioRecord = await AudioRecord.create({
      title: dayjs().format('YYYY-MM-DD HH:mm'),
      originalText: safeOriginalText,
      translatedText: safeTranslatedText,
      speakerId,
    })

    return res.status(203).send(audioRecord)
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
      { speakerId },
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

export const deleteAudioRecord = async (req: Request, res: Response) => {
  const { authorization } = req.headers
  const { id: recordId } = req.params

  if (!authorization) return res.status(403).json({ message: 'Invalid token' })
  if (!recordId) return res.status(400).json({ message: 'Missing id' })

  const verifiedToken = verifyToken(authorization as string)
  if (!verifiedToken?.id)
    return res.status(403).json({ message: 'Invalid token' })

  const deleted = await AudioRecord.findOneAndDelete({
    _id: recordId,
    owner: verifiedToken.id,
  }).exec()

  if (!deleted) return res.status(404).json({ message: 'No Record found' })

  await User.findByIdAndUpdate(verifiedToken.id, {
    $pull: { audioRecords: recordId },
  }).exec()

  return res.status(204).send()
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
