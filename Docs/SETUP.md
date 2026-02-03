# Car Show Manager - Initial Setup Guide

This guide covers the initial setup and configuration of the Car Show Manager application.

## Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **OpenSSL** (for generating self-signed certificates locally)

## Quick Start

1. Clone or download the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the database (use the filename from `config.json`, default is `carshow.db`):
   ```bash
   sqlite3 carshow.db < setup_sqllite_db.sql
   ```
4. Generate SSL certificates (see [SSL Certificates](#ssl-certificates))
5. Start the application:
   ```bash
   node app.js
   ```
6. Open your browser to `https://localhost:3001`
7. Accept the self-signed certificate warning
8. Complete the initial admin setup via the web interface

## Configuration

All application settings are stored in `config.json` in the project root.

### Port Configuration

```json
{
  "port": 3001,
  ...
}
```

Change the port number to run the application on a different port.

### Database Configuration

The application supports two database engines: **SQLite** (default) and **MySQL**.

#### SQLite (Default)

For a fresh SQLite database, you must initialize it with the schema file:

```bash
sqlite3 carshow.db < setup_sqllite_db.sql
```

The filename should match what's configured in `config.json`:

```json
{
  "database": {
    "engine": "sqlite",
    "sqlite": {
      "filename": "carshow.db"
    }
  }
}
```

After initialization, the application will automatically apply any schema migrations on startup (adding new columns, etc.).

#### MySQL

For MySQL, you must first create the database and user:

1. Run the setup script on your MySQL server:
   ```bash
   mysql -u root -p < setup_mysql_db.sql
   ```

2. Update `config.json` with your MySQL credentials:
   ```json
   {
     "database": {
       "engine": "mysql",
       "mysql": {
         "host": "localhost",
         "port": 3306,
         "database": "carshow",
         "user": "carshow_app",
         "password": "YOUR_SECURE_PASSWORD",
         "connectionLimit": 10,
         "waitForConnections": true,
         "queueLimit": 0
       }
     }
   }
   ```

### Application Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `appTitle` | Application title shown in header | "Car Show Manager" |
| `appSubtitle` | Subtitle on login page | "Sign in to your account" |
| `defaultRegistrationPrice` | Default vehicle registration fee | 25.00 |
| `defaultMinScore` | Minimum score judges can give | 0 |
| `defaultMaxScore` | Maximum score judges can give | 10 |
| `chatEnabled` | Enable/disable group chat feature | true |
| `chatMessageLimit` | Maximum messages stored in database | 200 |
| `animatedLogin` | Enable animated login background | true |

### Voting Status Settings

| Setting | Values | Description |
|---------|--------|-------------|
| `judgeVotingStatus` | "Open" / "Close" | Controls whether judges can submit scores |
| `specialtyVotingStatus` | "Open" / "Close" | Controls whether specialty voting is active |

## SSL Certificates

The application requires HTTPS. For local development, generate self-signed certificates:

### Generate Self-Signed Certificates

```bash
# Generate private key and certificate (valid for 365 days)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# When prompted, you can use these values:
# Country: US
# State: YourState
# Locality: YourCity
# Organization: Car Show
# Common Name: localhost
# Email: (leave blank)
```

Place `key.pem` and `cert.pem` in the parent directory of the project (or update paths in `app.js`).

### Certificate Location

By default, the application looks for certificates at:
- Key: `/path/to/project/../key.pem`
- Cert: `/path/to/project/../cert.pem`

Update these paths in `app.js` if your certificates are in a different location:
```javascript
const options = {
  key: fs.readFileSync('/path/to/your/key.pem'),
  cert: fs.readFileSync('/path/to/your/cert.pem')
};
```

## Initial Admin Setup

On first launch, the application has no users. The first user to register becomes the admin:

1. Navigate to `https://localhost:3001`
2. Click "Register"
3. Fill out the registration form
4. The first registered user is automatically assigned the **admin** role

**Recommendation**: Complete the initial setup internally before deploying publicly. Create all admin accounts and configure the system before opening registration to the public.

## Directory Structure

After setup, your project should look like:

```
car_show_management/
├── config.json          # Application configuration
├── carshow.db           # SQLite database (created automatically)
├── app.js               # Main application entry point
├── package.json         # Node.js dependencies
├── config/              # Configuration modules
├── db/                  # Database initialization
├── middleware/          # Express middleware
├── routes/              # Route handlers
├── views/               # View components
├── public/              # Static files (CSS, JS, images)
│   ├── css/
│   ├── js/
│   └── images/
├── images/              # Uploaded images
│   ├── profile_photos/
│   ├── vehicles/
│   └── app_config/
└── Docs/                # Documentation
```

## Next Steps

- See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions
- See [ROLES.md](ROLES.md) for user role documentation
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
