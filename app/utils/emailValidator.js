// Simple, reusable email validation utility.
// Order of validation:
// 1) Basic email format
// 2) If ALLOWED_EMAIL_DOMAINS is provided (comma-separated), domain MUST be in allowlist
// 3) Otherwise, block known bad/typo domains (e.g., "dgemail.com")

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

// Domains that should be rejected (common typos or disallowed providers)
const BLOCKED_DOMAINS = new Set([
  'dgemail.com', // common typo for gmail.com
  'gmaill.com',
  'gnail.com',
  'hotmial.com',
  'yaho.com',
  'outlok.com',
]);

// Optional allowlist via environment variable: ALLOWED_EMAIL_DOMAINS
// Example: "gmail.com,outlook.com,yahoo.com,proton.me,company.com"
let ALLOWED_DOMAINS = null;
try {
  const envValue = process.env.ALLOWED_EMAIL_DOMAINS;
  if (envValue && typeof envValue === 'string') {
    ALLOWED_DOMAINS = new Set(
      envValue
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    );
  }
} catch (_) {
  // ignore if process.env is unavailable in some contexts
}

export function isValidEmailFormat(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function isBlockedEmailDomain(email) {
  if (typeof email !== 'string') return false;
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return true; // missing domain part
  const domain = email.slice(atIndex + 1).toLowerCase().trim();
  return BLOCKED_DOMAINS.has(domain);
}

export function isAllowedEmailDomain(email) {
  if (!ALLOWED_DOMAINS) return true; // allow-all when no allowlist configured
  if (typeof email !== 'string') return false;
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return false;
  const domain = email.slice(atIndex + 1).toLowerCase().trim();
  return ALLOWED_DOMAINS.has(domain);
}

export function validateEmailOrThrow(email) {
  if (!isValidEmailFormat(email)) {
    const error = new Error('Invalid email format');
    error.statusCode = 400;
    throw error;
  }
  if (!isAllowedEmailDomain(email)) {
    const error = new Error('Email domain is not in the allowed list');
    error.statusCode = 400;
    throw error;
  }
  if (isBlockedEmailDomain(email)) {
    const error = new Error('Email domain is not allowed');
    error.statusCode = 400;
    throw error;
  }
}

export default {
  isValidEmailFormat,
  isBlockedEmailDomain,
  isAllowedEmailDomain,
  validateEmailOrThrow,
};


