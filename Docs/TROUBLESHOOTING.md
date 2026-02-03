# Car Show Manager - Troubleshooting Guide

This guide covers common issues and their solutions.

---

## Startup Issues

### "Error opening SQLite database"

**Symptom**: Application fails to start with database error.

**Causes & Solutions**:
1. **File permissions**: Ensure the application has write access to the directory
   ```bash
   chmod 755 /path/to/car_show_management
   ```

2. **Corrupted database**: If the database file is corrupted, remove it and restart (data will be lost)
   ```bash
   rm carshow.db
   node app.js
   ```

3. **Disk full**: Check available disk space
   ```bash
   df -h
   ```

### "ENOENT: no such file or directory, open '.../key.pem'"

**Symptom**: Application cannot find SSL certificates.

**Solution**: Generate certificates or update paths in `app.js`:
```bash
# Generate certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

Or update the certificate paths in `app.js` to match your certificate locations.

### "EACCES: permission denied, listen"

**Symptom**: Cannot bind to the configured port.

**Causes & Solutions**:
1. **Port in use**: Another process is using the port
   ```bash
   lsof -i :3001
   kill <PID>
   ```

2. **Privileged port**: Ports below 1024 require root (change to 3001+ in config.json)

3. **Port already bound**: Previous instance still running
   ```bash
   pkill -f "node app.js"
   ```

### MySQL Connection Errors

**"ECONNREFUSED" or "Access denied"**

1. Verify MySQL is running:
   ```bash
   sudo systemctl status mysql
   ```

2. Test connection manually:
   ```bash
   mysql -h localhost -u carshow_app -p carshow
   ```

3. Check credentials in `config.json`

4. Ensure user has proper grants:
   ```sql
   GRANT ALL PRIVILEGES ON carshow.* TO 'carshow_app'@'localhost';
   FLUSH PRIVILEGES;
   ```

---

## SSL/HTTPS Issues

### Browser Shows "Connection Not Private"

**For self-signed certificates (local development)**: This is expected. Click "Advanced" → "Proceed to localhost".

**For production**: Ensure:
- ACM certificate is validated
- ALB is configured with the certificate
- Route53 points to the ALB

### "ERR_SSL_PROTOCOL_ERROR"

**Causes**:
- Application running HTTP but browser expects HTTPS
- Certificate/key mismatch
- Corrupted certificate files

**Solutions**:
1. Regenerate certificates
2. Verify correct paths in `app.js`
3. Restart the application

---

## Login/Session Issues

### "Session expired" immediately after login

**Causes & Solutions**:

1. **Cookie settings**: Check browser allows cookies from the site

2. **Time skew**: Server time significantly different from client
   ```bash
   date
   sudo ntpdate pool.ntp.org
   ```

3. **Cookie domain issues**: When behind a proxy, ensure proper headers are forwarded

### Cannot login after database switch

**Solution**: User accounts are stored in the database. Switching from SQLite to MySQL (or vice versa) requires migrating user data or creating new accounts.

---

## Chat Issues

### Chat not loading

1. **Check if chat is enabled**:
   - Admin → Config → Chat Enabled: true
   - User's account has `chat_enabled: true`

2. **Socket.io connection**: Check browser console for WebSocket errors

3. **Firewall**: Ensure WebSocket connections are allowed

### Messages not appearing

1. **Rate limiting**: Wait 500ms between messages
2. **Blocked user**: Admin may have blocked the user from chat
3. **Connection lost**: Check for disconnection messages

### "Chat disabled" message

The user's chat access has been blocked by an admin. Contact an admin to restore access.

---

## Image Upload Issues

### "Invalid file type"

**Allowed types**: JPEG, PNG, GIF, WebP only

**Solution**: Convert image to an allowed format before uploading.

### "File too large"

**Limit**: 5MB maximum

**Solution**: Compress or resize the image before uploading.

### Images not displaying

1. **Check file permissions**:
   ```bash
   chmod -R 755 images/
   chmod -R 755 public/images/
   ```

2. **Verify image path**: Check if file exists at the expected path

3. **URL encoding**: Filenames with special characters may need encoding

---

## Performance Issues

### Slow page loads

1. **Database queries**: Large datasets may slow queries
   - Consider pagination
   - Add database indexes
   - Switch to MySQL for better performance

2. **Image optimization**: Large uploaded images slow rendering
   - Implement image compression on upload
   - Use thumbnails for listings

3. **Memory usage**: Check Node.js memory
   ```bash
   node --max-old-space-size=4096 app.js
   ```

### Socket.io disconnections

1. **Timeout settings**: Increase ping timeout if on slow networks

2. **Proxy configuration**: Ensure WebSocket upgrade headers are forwarded

3. **Load balancer**: Enable sticky sessions for Socket.io

---

## Logging

### Application Logs

**Console output** includes:
- HTTP requests (Morgan logging)
- Database connection status
- Error messages

**Log format**:
```
::ffff:127.0.0.1 - admin - GET /dashboard HTTP/1.1 200 12543 - 45.234 ms
```
- IP address
- Username (or 'anon')
- Method and path
- HTTP version
- Status code
- Response size
- Response time

### PM2 Logs

```bash
# View all logs
pm2 logs carshow

# View last 100 lines
pm2 logs carshow --lines 100

# Clear logs
pm2 flush carshow
```

### systemd Logs

```bash
# Follow logs in real-time
sudo journalctl -u carshow -f

# View logs from last hour
sudo journalctl -u carshow --since "1 hour ago"

# View logs from specific date
sudo journalctl -u carshow --since "2024-01-15"
```

### Enable Debug Logging

For more verbose output, set environment variable:
```bash
DEBUG=* node app.js
```

---

## Database Issues

### SQLite: "database is locked"

**Cause**: Multiple processes accessing the database simultaneously.

**Solutions**:
1. Ensure only one instance of the app is running
2. Consider switching to MySQL for concurrent access

### Reset Database

**Warning**: This deletes all data!

**SQLite**:
```bash
rm carshow.db
node app.js  # Creates fresh database
```

**MySQL**:
```sql
DROP DATABASE carshow;
CREATE DATABASE carshow;
-- Re-run setup_mysql_db.sql
```

### Backup Database

**SQLite**:
```bash
cp carshow.db backup_$(date +%Y%m%d_%H%M%S).db
```

**MySQL**:
```bash
mysqldump -h host -u user -p carshow > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `ECONNREFUSED` | Cannot connect to service | Check if service is running |
| `EADDRINUSE` | Port already in use | Stop other process or change port |
| `ENOENT` | File not found | Check file path |
| `EACCES` | Permission denied | Check file/directory permissions |
| `SQLITE_BUSY` | Database locked | Single instance, or use MySQL |
| `ER_ACCESS_DENIED` | MySQL auth failed | Check credentials |

---

## Getting Help

1. **Check logs first**: Most issues are logged to console or PM2/systemd logs

2. **Search common issues**: Review this document

3. **Report bugs**: https://github.com/anthropics/claude-code/issues
   - Include error messages
   - Include steps to reproduce
   - Include environment details (OS, Node version, etc.)
