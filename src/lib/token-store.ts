import fs from 'fs'
import path from 'path'

const TOKEN_FILE = path.join(process.cwd(), '.tokens.json')

interface TokenStore {
  google_primary?: any
  google_billing?: any
  google_operations?: any
  xero?: any
  [key: string]: any
}

function readStore(): TokenStore {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to read token store:', e)
  }
  return {}
}

function writeStore(store: TokenStore): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write token store:', e)
  }
}

export function getToken(key: string): any | null {
  const store = readStore()
  return store[key] || null
}

export function setToken(key: string, value: any): void {
  const store = readStore()
  store[key] = value
  writeStore(store)
}

export function removeToken(key: string): void {
  const store = readStore()
  delete store[key]
  writeStore(store)
}

export function hasToken(key: string): boolean {
  const store = readStore()
  return !!store[key]
}

export function getAllTokenKeys(): string[] {
  const store = readStore()
  return Object.keys(store)
}
