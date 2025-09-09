# Security Improvements: Session-Based Configuration Storage

## Overview

The application has been updated to use **session-based storage** instead of persistent database storage for sensitive API credentials. This significantly improves security by ensuring that API tokens and other sensitive configuration data are:

1. **Temporarily stored** in secure HTTP-only cookies
2. **Automatically expired** after a configurable time period
3. **Unique per browser session** instead of shared globally
4. **Cleared when the browser session ends**

## Key Security Features

### 1. Session-Based Storage
- API tokens, group IDs, and org IDs are stored in encrypted session cookies
- No persistent storage of sensitive credentials in the database
- Each browser/user has their own isolated configuration

### 2. Automatic Expiration
- **Default expiration**: 30 minutes
- **Available options**: 15 minutes (short), 30 minutes (medium), 60 minutes (long)
- Automatic cleanup of expired configurations
- Rolling expiration (resets on each request)

### 3. Secure Cookie Configuration
```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  httpOnly: true, // Prevent XSS attacks
  maxAge: 30 * 60 * 1000, // 30 minutes
  sameSite: 'strict' // CSRF protection
}
```

### 4. New API Endpoints

#### GET `/api/config`
- Returns current configuration (without API token)
- Includes `expiresInMinutes` field showing remaining time

#### POST `/api/config/clear`
- Immediately clears all configuration from the session
- Useful for explicit logout

#### POST `/api/config/extend`
- Extends the current session expiration
- Body: `{ "minutes": 30 }` (optional, defaults to 30)

## Environment Variables

Add to your `.env` file:
```bash
# Session secret for secure cookie signing (REQUIRED)
# Generate with: openssl rand -base64 32
SESSION_SECRET=your_session_secret_here_32_chars_minimum
```

## Frontend Changes

### Configuration Panel Updates
- Shows remaining session time: "✓ Configured (expires in 25m)"
- Added "Clear" button to immediately clear configuration
- Session expiration warnings

### Automatic Cleanup
- Expired configurations are automatically detected and cleared
- Users see appropriate "session expired" messages
- Graceful handling of expired sessions during API calls

## Usage Examples

### Setting Configuration with Custom Expiration
```typescript
// 15-minute expiration for sensitive environments
SessionBasedStorage.setApiConfiguration(req, config, EXPIRATION_TIMES.SHORT);

// 1-hour expiration for development
SessionBasedStorage.setApiConfiguration(req, config, EXPIRATION_TIMES.LONG);
```

### Checking Session Status
```typescript
const config = SessionBasedStorage.getApiConfiguration(req);
if (!config) {
  // Session expired or not configured
  return res.status(400).json({ error: "Session expired, please reconfigure" });
}

const timeLeft = SessionBasedStorage.getTimeUntilExpiration(req);
console.log(`Configuration expires in ${timeLeft} minutes`);
```

## Migration Notes

### Breaking Changes
- Configuration is no longer persistent across server restarts
- Users need to reconfigure after browser sessions end
- Old persistent configurations in the database are ignored

### Benefits
- Significantly reduced attack surface
- No sensitive data in database logs or backups
- Per-user isolation prevents cross-contamination
- Compliance with security best practices for handling API tokens

## Security Best Practices Implemented

1. **No Persistent Token Storage**: API tokens never touch the database
2. **Session Isolation**: Each browser session is completely isolated
3. **Automatic Expiration**: Forced re-authentication prevents stale access
4. **Secure Cookies**: HTTP-only, secure, and SameSite protection
5. **Clear Separation**: Session data completely separate from application data
6. **Explicit Cleanup**: Manual and automatic session clearing capabilities

## Recommendations

1. **Set SESSION_SECRET**: Always use a strong, unique session secret in production
2. **Use HTTPS**: Enable secure cookies by setting `NODE_ENV=production`
3. **Monitor Sessions**: Consider logging session creation/expiration for audit trails
4. **Educate Users**: Inform users about session expiration and the need to reconfigure
5. **Backup Strategy**: Since configurations aren't persistent, ensure users can easily reconfigure

This approach follows security principles of **least privilege**, **defense in depth**, and **time-limited access** to significantly reduce the risk associated with API token storage.
