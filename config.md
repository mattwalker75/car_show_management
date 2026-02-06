# Configuration Reference

This document describes all configuration options in `config.json`.

---

## Server Settings

### `port`
- **Type:** Number
- **Default:** `3001`
- **Description:** The port the server listens on.

### `server`
- **Type:** Object
- **Description:** Server configuration for SSL/TLS, proxy settings, and certificate paths. All network-related settings are grouped here for easy deployment configuration.

#### `server.ssl`
- **Type:** Boolean
- **Default:** `true`
- **Description:** Enable or disable HTTPS mode.
  - `true`: Run HTTPS server with certificate files (local development, direct deployment)
  - `false`: Run HTTP server (for deployment behind AWS ALB, nginx, or other SSL-terminating proxy)

#### `server.keyPath`
- **Type:** String
- **Default:** `"./key.pem"`
- **Description:** Path to SSL private key file. Only used when `server.ssl` is `true`.

#### `server.certPath`
- **Type:** String
- **Default:** `"./cert.pem"`
- **Description:** Path to SSL certificate file. Only used when `server.ssl` is `true`.

#### `server.trustProxy`
- **Type:** Number or Boolean
- **Default:** `false`
- **Description:** Configures Express to trust proxy headers (`X-Forwarded-For`) for determining client IP addresses. Required for correct rate limiting and logging when behind a reverse proxy.

| Value | Use Case |
|-------|----------|
| `false` | Direct connections (local development, no proxy) |
| `1` | Single proxy (e.g., AWS ALB, nginx, Heroku) |
| `2` | Two proxies (e.g., CloudFlare → nginx) |
| `true` | **INSECURE** - Trusts all `X-Forwarded-For` entries, allowing IP spoofing |

**Important:** Never use `true` in production. Attackers can bypass rate limiting by spoofing the `X-Forwarded-For` header. Always use a specific number matching your proxy hop count.

**Local Development (HTTPS with self-signed cert):**
```json
{
    "server": {
        "ssl": true,
        "keyPath": "./key.pem",
        "certPath": "./cert.pem",
        "trustProxy": false
    }
}
```

**AWS ALB Deployment (HTTP behind load balancer):**
```json
{
    "server": {
        "ssl": false,
        "trustProxy": 1
    }
}
```

---

## Session Settings

### `sessionKeys`
- **Type:** Array of strings
- **Default:** `["change-this-to-a-random-secret-key", "change-this-backup-key-too"]`
- **Description:** Secret keys used to sign session cookies. **Change these for production!** Use long, random strings (32+ characters). The first key is used for signing; additional keys allow rotation without invalidating existing sessions.

---

## Database Settings

### `database.engine`
- **Type:** String (`"sqlite"` or `"mysql"`)
- **Default:** `"sqlite"`
- **Description:** Which database engine to use.

### `database.sqlite.filename`
- **Type:** String
- **Default:** `"carshow.db"`
- **Description:** SQLite database file name (relative to project root).

### `database.mysql`
- **Type:** Object
- **Description:** MySQL connection settings (only used when `engine` is `"mysql"`).
  - `host`: Database server hostname
  - `port`: Database server port (default: 3306)
  - `database`: Database name
  - `user`: Database username
  - `password`: Database password
  - `connectionLimit`: Maximum connections in pool (default: 10)
  - `waitForConnections`: Wait for available connection (default: true)
  - `queueLimit`: Max queued requests (0 = unlimited)

---

## Application Settings

### `appTitle`
- **Type:** String
- **Default:** `"Car Show Manager"`
- **Description:** Application title displayed in the header and browser tab.

### `appSubtitle`
- **Type:** String
- **Default:** `"Sign in to your account"`
- **Description:** Subtitle shown on the login page.

### `theme`
- **Type:** String (`"light"` or `"dark"`)
- **Default:** `"light"`
- **Description:** Application color theme.

---

## Voting Settings

### `judgeVotingStatus`
- **Type:** String (`"Open"`, `"Close"`, or `"Lock"`)
- **Default:** `"Close"`
- **Description:** Controls judge voting availability.
  - `"Open"`: Judges can submit and modify scores
  - `"Close"`: Voting paused, scores can be modified when reopened
  - `"Lock"`: Voting permanently closed, no modifications allowed

### `specialtyVotingStatus`
- **Type:** String (`"Open"`, `"Close"`, or `"Lock"`)
- **Default:** `"Close"`
- **Description:** Controls specialty voting (People's Choice, etc.) availability. Same options as `judgeVotingStatus`.

### `defaultRegistrationPrice`
- **Type:** Number
- **Default:** `25`
- **Description:** Default registration fee for new vehicle classes.

### `defaultMinScore`
- **Type:** Number
- **Default:** `0`
- **Description:** Default minimum score for judge scoring questions.

### `defaultMaxScore`
- **Type:** Number
- **Default:** `5`
- **Description:** Default maximum score for judge scoring questions.

---

## Login Page Appearance

### `animatedLogin`
- **Type:** Boolean
- **Default:** `false`
- **Description:** Enable animated background effects on the login page.

### `loginBackground`
- **Type:** Object
- **Description:** Login page background styling.
  - `useImage`: Boolean - Use a background image
  - `imageUrl`: String - Path to background image (when `useImage` is true)
  - `backgroundColor`: String - Hex color code for solid background
  - `useTint`: Boolean - Apply a color tint overlay
  - `tintColor`: String - Hex color code for tint
  - `tintOpacity`: Number (0-1) - Tint layer opacity
  - `cardOpacity`: Number (0-1) - Login card opacity

---

## App Background Appearance

### `appBackground`
- **Type:** Object
- **Description:** Main application background styling (same structure as `loginBackground`).
  - `useImage`: Boolean - Use a background image
  - `imageUrl`: String - Path to background image
  - `backgroundColor`: String - Hex color code for solid background
  - `useTint`: Boolean - Apply a color tint overlay
  - `tintColor`: String - Hex color code for tint
  - `tintOpacity`: Number (0-1) - Tint layer opacity
  - `containerOpacity`: Number (0-1) - Content container opacity

---

## Chat Settings

### `chatEnabled`
- **Type:** Boolean
- **Default:** `false`
- **Description:** Enable or disable the group chat feature globally. Individual users must also have `chat_enabled` set in their account.

### `chatMessageLimit`
- **Type:** Number
- **Default:** `200`
- **Description:** Maximum number of chat messages stored in the database. When exceeded, oldest messages are automatically deleted.

---

## Security Settings

### `security.rateLimiting.auth`
- **Type:** Object
- **Description:** Rate limiting for authentication endpoints (login, register). Applied **per IP address** to prevent brute force attacks.
  - `windowSeconds`: Number - Time window in seconds (default: 900 = 15 minutes)
  - `maxAttempts`: Number - Maximum login attempts per window (default: 5)

### `security.rateLimiting.api`
- **Type:** Object
- **Description:** Rate limiting for general API endpoints. Applied **per IP address** to prevent abuse.
  - `windowSeconds`: Number - Time window in seconds (default: 60 = 1 minute)
  - `maxRequests`: Number - Maximum requests per window (default: 100)

### `security.headers`
- **Type:** Object
- **Description:** HTTP security headers configuration (via Helmet middleware).
  - `enabled`: Boolean - Enable security headers (default: true)
  - `contentSecurityPolicy`: Boolean - Enable Content-Security-Policy header. Restricts sources for scripts, styles, and other resources. May require adjustment if using external CDNs. (default: false)
  - `crossOriginEmbedderPolicy`: Boolean - Enable Cross-Origin-Embedder-Policy header. May break loading of external images or resources. (default: false)

**Security Headers Explained:**

When `enabled` is true, the following headers are automatically set:

| Header | Purpose |
|--------|---------|
| `X-Content-Type-Options: nosniff` | Prevents browsers from MIME-sniffing responses away from declared content type |
| `X-Frame-Options: SAMEORIGIN` | Prevents clickjacking by blocking page embedding in iframes on other sites |
| `X-XSS-Protection: 0` | Disables legacy XSS filter (modern CSP is preferred) |
| `Strict-Transport-Security` | Forces HTTPS connections for specified duration (HSTS) |
| `X-DNS-Prefetch-Control: off` | Disables DNS prefetching for privacy |
| `X-Download-Options: noopen` | Prevents IE from executing downloads in site context |
| `X-Permitted-Cross-Domain-Policies: none` | Restricts Adobe Flash/PDF cross-domain requests |
| `Referrer-Policy: no-referrer` | Controls how much referrer info is sent with requests |

### `security.session`
- **Type:** Object
- **Description:** Session cookie security settings.
  - `secure`: Boolean - Only send cookie over HTTPS (default: true). **Set to false only for local HTTP development.**
  - `httpOnly`: Boolean - Prevent JavaScript access to session cookie (default: true). Protects against XSS attacks stealing session tokens.
  - `sameSite`: String (`"strict"`, `"lax"`, or `"none"`) - Controls when cookies are sent with cross-site requests (default: `"strict"`).

**SameSite Values Explained:**

| Value | Behavior |
|-------|----------|
| `"strict"` | Cookie only sent for same-site requests. Best protection against CSRF but may break external links into authenticated pages. |
| `"lax"` | Cookie sent for same-site requests and top-level navigation from external sites. Balanced security. |
| `"none"` | Cookie sent for all requests (requires `secure: true`). Use only if cross-site cookie access is required. |

---

## Example Configuration

```json
{
    "_documentation": "See config.md for detailed documentation of all configuration options",
    "port": 3001,
    "server": {
        "ssl": true,
        "keyPath": "./key.pem",
        "certPath": "./cert.pem",
        "trustProxy": false
    },
    "sessionKeys": [
        "your-secret-key-here-make-it-long-and-random",
        "backup-key-for-rotation"
    ],
    "database": {
        "engine": "sqlite",
        "sqlite": {
            "filename": "carshow.db"
        }
    },
    "appTitle": "My Car Show",
    "judgeVotingStatus": "Close",
    "specialtyVotingStatus": "Close",
    "chatEnabled": true,
    "chatMessageLimit": 200,
    "security": {
        "rateLimiting": {
            "auth": {
                "windowSeconds": 900,
                "maxAttempts": 5
            },
            "api": {
                "windowSeconds": 60,
                "maxRequests": 100
            }
        },
        "headers": {
            "enabled": true,
            "contentSecurityPolicy": false,
            "crossOriginEmbedderPolicy": false
        },
        "session": {
            "secure": true,
            "httpOnly": true,
            "sameSite": "strict"
        }
    }
}
```
