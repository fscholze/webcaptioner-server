export const isIncomprehensibleTranscription = (plainText: string): boolean => {
  const normalized = plainText.trim().toLowerCase().replace(/[.,!?…]+$/, '')
  return normalized === 'njezrozumliwe'
}
