type LogData = unknown

function ts(): string {
  return new Date().toISOString()
}

export const logger = {
  info: (context: string, message: string, data?: LogData) =>
    console.log(`[${ts()}] [INFO] [${context}] ${message}`, data ?? ''),
  warn: (context: string, message: string, data?: LogData) =>
    console.warn(`[${ts()}] [WARN] [${context}] ${message}`, data ?? ''),
  error: (context: string, message: string, error?: LogData) =>
    console.error(`[${ts()}] [ERROR] [${context}] ${message}`, error ?? ''),
}

export default logger
