# Car Show Manager - Deployment Guide

This guide covers deploying the Car Show Manager application locally and on AWS.

## Local Deployment

### Basic Setup

1. Complete the steps in [SETUP.md](SETUP.md)
2. Generate self-signed SSL certificates
3. Start the application:
   ```bash
   node app.js
   ```

### Running in the Background

#### Using nohup (Simple)
```bash
nohup node app.js > app.log 2>&1 &
```

To stop:
```bash
pkill -f "node app.js"
```

#### Using PM2 (Recommended for Production)

Install PM2:
```bash
npm install -g pm2
```

Start the application:
```bash
pm2 start app.js --name carshow
```

Common PM2 commands:
```bash
pm2 status              # Check status
pm2 logs carshow        # View logs
pm2 restart carshow     # Restart application
pm2 stop carshow        # Stop application
pm2 delete carshow      # Remove from PM2
pm2 startup             # Configure auto-start on boot
pm2 save                # Save current process list
```

#### Using systemd (Linux)

Create a service file at `/etc/systemd/system/carshow.service`:

```ini
[Unit]
Description=Car Show Manager
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/car_show_management
ExecStart=/usr/bin/node app.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=carshow
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable carshow
sudo systemctl start carshow
sudo systemctl status carshow
```

View logs:
```bash
sudo journalctl -u carshow -f
```

---

## AWS Deployment

This section covers deploying to AWS EC2 with Route53 DNS, Application Load Balancer (ALB), and AWS Certificate Manager (ACM) for SSL.

### Architecture Overview

```
Users → Route53 (DNS) → ALB (HTTPS:443) → EC2 (HTTP:3001)
                           ↓
                    ACM Certificate
```

### Step 1: Launch EC2 Instance

1. **Launch an EC2 instance**:
   - AMI: Amazon Linux 2023 or Ubuntu 22.04
   - Instance type: t3.micro (free tier) or t3.small
   - Storage: 20GB gp3

2. **Security Group** (create or modify):
   - Inbound: SSH (22) from your IP
   - Inbound: HTTP (3001) from ALB security group only
   - Outbound: All traffic

3. **Connect and install Node.js**:
   ```bash
   # Amazon Linux 2023
   sudo dnf install -y nodejs npm git

   # Ubuntu
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```

4. **Deploy the application**:
   ```bash
   cd /home/ubuntu  # or /home/ec2-user
   git clone <your-repo-url> car_show_management
   cd car_show_management
   npm install
   ```

5. **Configure for ALB** (HTTP mode):

   Since ALB handles SSL termination, modify `app.js` for HTTP:
   ```javascript
   // For ALB deployment, use HTTP instead of HTTPS
   const http = require('http');
   const server = http.createServer(app);
   ```

   Or create a separate `app-alb.js` that uses HTTP.

6. **Start with PM2**:
   ```bash
   npm install -g pm2
   pm2 start app.js --name carshow
   pm2 startup
   pm2 save
   ```

### Step 2: Request ACM Certificate

1. Go to **AWS Certificate Manager** in the AWS Console
2. Click **Request a certificate**
3. Select **Request a public certificate**
4. Enter your domain name(s):
   - `carshow.yourdomain.com`
   - `*.yourdomain.com` (optional wildcard)
5. Choose **DNS validation**
6. Click **Request**
7. Click into the certificate and click **Create records in Route53**
8. Wait for validation (usually within minutes)

### Step 3: Create Application Load Balancer

1. Go to **EC2 → Load Balancers**
2. Click **Create Load Balancer** → **Application Load Balancer**

3. **Basic Configuration**:
   - Name: `carshow-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4

4. **Network Mapping**:
   - VPC: Select your VPC
   - Availability Zones: Select at least 2 AZs

5. **Security Groups**:
   Create a new security group:
   - Inbound: HTTPS (443) from 0.0.0.0/0
   - Inbound: HTTP (80) from 0.0.0.0/0 (for redirect)
   - Outbound: All traffic

6. **Listeners and Routing**:

   **HTTPS Listener (443)**:
   - Protocol: HTTPS
   - Port: 443
   - Default action: Forward to target group
   - Select your ACM certificate

   **HTTP Listener (80)** (optional, for redirect):
   - Protocol: HTTP
   - Port: 80
   - Default action: Redirect to HTTPS

7. **Create Target Group**:
   - Target type: Instances
   - Name: `carshow-tg`
   - Protocol: HTTP
   - Port: 3001
   - Health check path: `/login`
   - Register your EC2 instance

8. **Create the load balancer**

### Step 4: Configure Route53

1. Go to **Route53 → Hosted zones**
2. Select your domain's hosted zone
3. Click **Create record**
4. Configure:
   - Record name: `carshow` (or leave blank for root domain)
   - Record type: A
   - Alias: Yes
   - Route traffic to: Alias to Application Load Balancer
   - Region: Your ALB region
   - Select your ALB
5. Click **Create records**

### Step 5: Update EC2 Security Group

Update your EC2 security group to only allow traffic from the ALB:

1. Go to **EC2 → Security Groups**
2. Select your EC2 instance's security group
3. Edit inbound rules:
   - Remove direct HTTP/HTTPS access
   - Add: Custom TCP, Port 3001, Source: ALB security group

### Step 6: Test the Deployment

1. Wait for DNS propagation (usually within minutes)
2. Navigate to `https://carshow.yourdomain.com`
3. Verify SSL certificate shows as valid
4. Complete initial admin setup

---

## Environment-Specific Configuration

### Development (Local)
```json
{
  "port": 3001,
  "database": {
    "engine": "sqlite"
  }
}
```

### Production (AWS)
```json
{
  "port": 3001,
  "database": {
    "engine": "mysql",
    "mysql": {
      "host": "your-rds-endpoint.region.rds.amazonaws.com",
      "port": 3306,
      "database": "carshow",
      "user": "carshow_app",
      "password": "SECURE_PASSWORD"
    }
  }
}
```

---

## SSL Certificate Notes

### Local Development
- Use self-signed certificates
- Browser will show security warning (expected)
- Generate with OpenSSL (see [SETUP.md](SETUP.md))

### AWS Production
- Use ACM for free, auto-renewing certificates
- SSL termination happens at ALB
- EC2 runs HTTP internally (no certificate needed on instance)

---

## Monitoring and Maintenance

### Application Logs

**PM2 Logs**:
```bash
pm2 logs carshow
pm2 logs carshow --lines 100
```

**systemd Logs**:
```bash
sudo journalctl -u carshow -f
sudo journalctl -u carshow --since "1 hour ago"
```

### Database Backups

**SQLite**:
```bash
# Simple file copy
cp carshow.db carshow_backup_$(date +%Y%m%d).db
```

**MySQL**:
```bash
mysqldump -h hostname -u user -p carshow > backup_$(date +%Y%m%d).sql
```

### Health Checks

The ALB health check verifies the `/login` endpoint returns HTTP 200.

To manually check:
```bash
curl -I http://localhost:3001/login
```

---

## Scaling Considerations

For higher traffic:

1. **Horizontal Scaling**: Add more EC2 instances to the target group
2. **Database**: Migrate from SQLite to MySQL/RDS
3. **Sessions**: Consider Redis for session storage across multiple instances
4. **Static Assets**: Use CloudFront CDN for images and static files
5. **File Storage**: Use S3 for uploaded images instead of local filesystem
