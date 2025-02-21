import { Schema, model } from 'mongoose'
import { IAudioRecord } from './audio-record'

export enum UserRole {
  'USER' = 'USER',
  'ADMIN' = 'ADMIN',
}

export interface IUser {
  firstname: string
  lastname: string
  email: string
  password: string
  role: UserRole
  audioRecords: IAudioRecord[]
}

const userSchema = new Schema<IUser>(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
      required: true,
      unique: true,
      maxlength: 255,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      bcrypt: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    audioRecords: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AudioRecord',
      },
    ],
  },
  { timestamps: true }
)

export const User = model<IUser>('User', userSchema)
