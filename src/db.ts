import mongoose from 'mongoose'

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!)
    console.log('🚀 Connected to MongoDB')
  } catch (error) {
    console.log('❌ Error connecting to MongoDB:', error)
    process.exit(1)
  }
}
