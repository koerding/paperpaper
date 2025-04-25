import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 * @param  {...any} inputs - Class inputs
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted size
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Generate a random ID
 * @param {number} length - ID length
 * @returns {string} - Random ID
 */
export function generateId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return result
}

/**
 * Convert URL to File object
 * @param {string} url - URL to file
 * @param {string} filename - Name for the file
 * @returns {Promise<File>} - File object
 */
export async function urlToFile(url, filename) {
  const response = await fetch(url)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type })
}

/**
 * Delay execution for specified time
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Extract first N words from a string
 * @param {string} text - Text to extract from
 * @param {number} count - Number of words to extract
 * @returns {string} - Extracted words
 */
export function extractFirstWords(text, count = 10) {
  if (!text) return ''
  const words = text.split(/\s+/)
  return words.slice(0, count).join(' ') + (words.length > count ? '...' : '')
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename
 * @returns {string} - Extension
 */
export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase()
}

/**
 * Validate file type against allowed types
 * @param {string} type - File MIME type
 * @param {string} filename - File name
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @param {Array} allowedExtensions - Array of allowed extensions
 * @returns {boolean} - Whether file is valid
 */
export function validateFileType(type, filename, allowedTypes, allowedExtensions) {
  if (allowedTypes.includes(type)) return true
  
  const extension = getFileExtension(filename)
  return allowedExtensions.includes(extension)
}

/**
 * Parse JSON safely with fallback
 * @param {string} jsonString - JSON string
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} - Parsed object or fallback
 */
export function safeJsonParse(jsonString, fallback = {}) {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return fallback
  }
}
