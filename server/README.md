# SL Phone Hub API Server

A robust Node.js API server for SL Phone Hub marketplace with image upload, authentication, and SQLite database.

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start the Server
```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

### 3. Default Admin Credentials
- **Email:** admin@slphonehub.com
- **Password:** slphonehub123

⚠️ **Important:** Change the default password in production!

## API Endpoints

### Public
- `GET /api/health` - Health check
- `GET /api/phones` - Get all products (with filtering)

### Admin (Authentication Required)
- `POST /api/admin/login` - Admin login
- `POST /api/phones` - Create product
- `PUT /api/phones/:id` - Update product
- `DELETE /api/phones/:id` - Delete product

## Features

✅ **Secure Authentication** - JWT-based admin authentication
✅ **Image Upload** - File upload with size limits and validation
✅ **Base64 Support** - Handles both file uploads and base64 images
✅ **Rate Limiting** - Protection against abuse
✅ **CORS Enabled** - Cross-origin requests supported
✅ **SQLite Database** - Lightweight, file-based database
✅ **Error Handling** - Comprehensive error handling
✅ **Graceful Shutdown** - Proper cleanup on server stop

## Database Schema

### Products Table
- id (TEXT, PRIMARY KEY)
- name (TEXT)
- brand (TEXT)
- category (TEXT)
- condition (TEXT)
- price (REAL)
- storage (TEXT)
- stock (INTEGER)
- description (TEXT)
- specs (TEXT)
- inStock (BOOLEAN)
- featured (BOOLEAN)
- cover (TEXT)
- allImages (TEXT, JSON array)
- created_at (DATETIME)
- updated_at (DATETIME)

### Admin Users Table
- id (TEXT, PRIMARY KEY)
- email (TEXT, UNIQUE)
- password (TEXT, hashed)
- created_at (DATETIME)

## Environment Variables

Optional:
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT secret key (change in production!)

## File Upload

- **Max file size:** 5MB per file
- **Allowed types:** Images only
- **Storage:** Local `/uploads` directory
- **Supported:** Both file uploads and base64 images

## Security Features

- Helmet.js for security headers
- Rate limiting (100 requests per 15 minutes)
- Input validation
- File type validation
- JWT authentication
- CORS protection

## Deployment

### PM2 (Recommended for production)
```bash
# Install PM2
npm install -g pm2

# Start server with PM2
pm2 start server.js --name slphonehub-api

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```

### Cloudflare Tunnel (for public access)
```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Configure tunnel
cloudflared tunnel create slphonehub-api
# Edit config.yml to route api.slphonehub.com to localhost:3000

# Run tunnel
cloudflared tunnel run slphonehub-api
```

## Monitoring

Check server status:
```bash
# PM2 status
pm2 list

# PM2 logs
pm2 logs slphonehub-api

# Server health
curl http://localhost:3000/api/health
```

## Troubleshooting

### Database Issues
- Database file: `slphonehub.db`
- Backup: `cp slphonehub.db slphonehub.db.backup`
- Reset: `rm slphonehub.db` (will recreate on restart)

### Image Issues
- Uploads directory: `./uploads`
- Permissions: Ensure write access
- Size limit: 5MB per file

### Authentication Issues
- Clear browser localStorage
- Check JWT_SECRET environment variable
- Verify admin credentials in database
