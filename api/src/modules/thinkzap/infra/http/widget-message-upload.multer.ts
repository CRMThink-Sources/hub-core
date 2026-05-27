import multer from 'multer'

export const WIDGET_MESSAGE_MAX_FILE_BYTES = 30 * 1024 * 1024
export const WIDGET_MESSAGE_MAX_FILES = 10

export const widgetMessageUploadParser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: WIDGET_MESSAGE_MAX_FILE_BYTES,
    files: WIDGET_MESSAGE_MAX_FILES,
  },
})
