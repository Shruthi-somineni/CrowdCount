# Token Refresh System

This document explains how to use the new token refresh system.

## Overview

The system now uses two types of tokens:
1. Access Token (short-lived, 15 minutes)
2. Refresh Token (long-lived, 30 days)

## How It Works

1. On login/register, the server returns both tokens:
```javascript
{
  "accessToken": "eyJ...", // JWT token, valid for 15 minutes
  "refreshToken": "abc...", // Long random string, valid for 30 days
  "user": {
    "id": 1,
    "name": "User Name",
    "username": "user",
    "email": "user@example.com"
  }
}
```

2. Use the access token for API calls:
```javascript
fetch('http://localhost:3000/api/me', {
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});
```

3. When the access token expires, use the refresh token to get a new one:
```javascript
async function refreshAccessToken(refreshToken) {
  const res = await fetch('http://localhost:3000/api/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const data = await res.json();
  return data.accessToken;
}
```

4. To logout, revoke the refresh token:
```javascript
fetch('http://localhost:3000/api/logout', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ refreshToken })
});
```

## Example Implementation

```javascript
// Store tokens after login
let accessToken = null;
let refreshToken = null;

async function login(username, password) {
  const res = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  
  // Store refresh token securely (e.g., HTTP-only cookie in production)
  localStorage.setItem('refreshToken', refreshToken);
}

async function callApi(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    if (res.status === 401) {
      // Access token expired, try to refresh it
      accessToken = await refreshAccessToken(refreshToken);
      // Retry the API call
      return callApi(url);
    }
    
    return res.json();
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}

async function logout() {
  try {
    await fetch('http://localhost:3000/api/logout', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });
    
    // Clear tokens
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('refreshToken');
    
    // Redirect to login page
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout failed:', err);
    throw err;
  }
}
```

## Testing with curl

1. Login to get tokens:
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"password123"}'
```

2. Use access token:
```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer <access_token>"
```

3. Refresh access token:
```bash
curl -X POST http://localhost:3000/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

4. Logout:
```bash
curl -X POST http://localhost:3000/api/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

## Security Notes

1. Access tokens are short-lived (15 minutes) to minimize risk if stolen
2. Refresh tokens are stored in the database and can be revoked
3. Using a refresh token automatically validates it against the database
4. Expired refresh tokens are automatically cleaned up hourly
5. For production:
   - Store refresh tokens in HTTP-only cookies
   - Use secure session management
   - Add rate limiting on refresh endpoint
   - Consider token rotation on refresh