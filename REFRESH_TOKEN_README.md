# Refresh Token Implementation

This document explains the refresh token implementation added to the VisionIndex authentication system.

## Overview

The refresh token system provides secure, long-lived authentication by using two tokens:
- **Access Token**: Short-lived (15 minutes) JWT for API requests
- **Refresh Token**: Long-lived (7 days) random string stored in database

## Backend Changes

### 1. User Model (`app/models/User.js`)
Added methods to handle refresh tokens:
- `setRefreshToken(userId, refreshToken)` - Store refresh token
- `findByRefreshToken(refreshToken)` - Find user by refresh token
- `clearRefreshToken(userId)` - Remove refresh token

### 2. Auth Controller (`app/controllers/authController.js`)
- **Login**: Now generates both access and refresh tokens
- **Logout**: Clears both tokens from cookies and database
- **Refresh Token**: New endpoint to generate new access tokens

### 3. Auth Routes (`app/routes/authRoutes.js`)
Added new route:
- `POST /auth/refresh` - Refresh access token using refresh token

## Frontend Changes

### 1. Auth API (`src/api/auth.js`)
Added `refreshToken()` function to call the refresh endpoint.

### 2. HTTP Client (`src/api/http.js`)
Implemented automatic token refresh:
- Intercepts 403 responses (expired access token)
- Automatically calls refresh endpoint
- Retries original request with new token
- Queues multiple requests during refresh to prevent race conditions

## Database Migration

Run the SQL script `migration_add_refresh_token.sql` to add the required column:

```sql
ALTER TABLE users ADD COLUMN refresh_token TEXT;
CREATE INDEX idx_users_refresh_token ON users(refresh_token);
```

## Security Features

1. **HttpOnly Cookies**: Both tokens stored in HttpOnly cookies (not accessible via JavaScript)
2. **Secure Cookies**: Uses secure flag in production
3. **SameSite Protection**: Prevents CSRF attacks
4. **Token Rotation**: Refresh tokens are stored in database for revocation
5. **Automatic Cleanup**: Refresh tokens cleared on logout

## Token Lifecycle

1. **Login**: User provides credentials
2. **Token Generation**: System creates access token (15min) + refresh token (7 days)
3. **API Requests**: Access token sent automatically via cookies
4. **Token Expiry**: When access token expires (403 response)
5. **Auto Refresh**: System automatically refreshes access token
6. **Logout**: Both tokens cleared from cookies and database

## Configuration

### Environment Variables
Make sure these are set in your `.env` file:
```
JWT_SECRET=your-secret-key
NODE_ENV=production  # For secure cookies
```

### Token Expiration Times
- Access Token: 15 minutes (configurable in `authController.js`)
- Refresh Token: 7 days (configurable in `authController.js`)

## Testing

To test the refresh token functionality:

1. Login with valid credentials
2. Wait for access token to expire (or manually expire it)
3. Make an API request - should automatically refresh
4. Check that subsequent requests work without re-login

## Error Handling

- **Invalid Refresh Token**: User redirected to login page
- **Network Errors**: Proper error handling with user feedback
- **Concurrent Requests**: Queued during refresh to prevent multiple refresh attempts

## Benefits

1. **Better Security**: Shorter access token lifetime reduces attack window
2. **Seamless UX**: Users don't need to re-login frequently
3. **Token Revocation**: Refresh tokens can be invalidated server-side
4. **Automatic Handling**: No manual token management required
5. **Race Condition Prevention**: Multiple requests handled gracefully during refresh
