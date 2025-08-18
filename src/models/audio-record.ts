import { Schema, model, CallbackError } from 'mongoose'
import { IUser } from './user'

const generateToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export interface IAudioRecord {
  createdAt: Date
  title: string
  originalText: string[]
  translatedText: string[]
  owner: IUser
  token: string
  speakerId: number | null
}

const audioRecordSchema = new Schema<IAudioRecord>(
  {
    originalText: {
      type: [String],
      required: true,
    },
    translatedText: {
      type: [String],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: generateToken,
    },
    speakerId: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
)

// Pre-save hook to ensure token uniqueness
audioRecordSchema.pre('save', async function (next) {
  if (!this.isModified('token')) return next()

  let isUnique = false
  let attempts = 0
  const maxAttempts = 10

  while (!isUnique && attempts < maxAttempts) {
    try {
      const existingRecord = await AudioRecord.findOne({ token: this.token })
      if (!existingRecord) {
        isUnique = true
      } else {
        this.token = generateToken()
      }
    } catch (error) {
      return next(error as CallbackError)
    }
    attempts++
  }

  if (!isUnique) {
    return next(
      new Error('Could not generate unique token after multiple attempts')
    )
  }

  next()
})

export const AudioRecord = model<IAudioRecord>('AudioRecord', audioRecordSchema)
