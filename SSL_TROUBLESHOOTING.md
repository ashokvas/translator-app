# SSL Troubleshooting for Coolify

## Step 1: Verify DNS is Working

```bash
# SSH into your VPS
ssh root@213.199.50.227

# Check if domain resolves correctly
dig translatoraxis.com
# Should return your VPS IP: 213.199.50.227

# Or
nslookup translatoraxis.com
```

## Step 2: Check Port Accessibility

```bash
# Check if ports 80 and 443 are open
sudo netstat -tlnp | grep -E ':(80|443)'

# Check firewall
sudo ufw status
# Ports 80 and 443 should be ALLOW

# If not open, allow them:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Step 3: Check Coolify/Traefik Logs

```bash
# Check Coolify Traefik container logs
sudo docker ps | grep traefik
# Note the container name/ID

# View Traefik logs
sudo docker logs coolify-traefik
# or
sudo docker logs <traefik-container-id>

# Look for SSL/certificate errors
```

## Step 4: Check if SSL Certificate Exists

```bash
# Check Let's Encrypt certificates
sudo ls -la /data/coolify/ssl/
# or
sudo ls -la /var/lib/docker/volumes/coolify_*/_data/ssl/

# Check certbot certificates
sudo certbot certificates
```

## Step 5: Manual SSL Setup (If Coolify Auto-SSL Fails)

If Coolify isn't automatically provisioning SSL, we can set it up manually:

### Option A: Use Certbot Standalone (Temporary Stop Coolify)

```bash
# Stop Coolify temporarily
sudo docker stop coolify-traefik

# Get certificate using standalone mode
sudo certbot certonly --standalone -d translatoraxis.com

# Start Coolify again
sudo docker start coolify-traefik
```

### Option B: Configure Traefik Manually

Check Traefik configuration in Coolify volumes:

```bash
# Find Traefik config
sudo find /data -name "traefik.yml" 2>/dev/null
# or
sudo find /var/lib/docker/volumes -name "traefik.yml" 2>/dev/null
```

## Step 6: Verify Domain in Coolify

Make sure the domain is correctly configured:
1. Go to General → Domains
2. Should be: `translatoraxis.com` (no http:// or https://)
3. Save
4. Check "Force Https" is enabled in Advanced

## Step 7: Check Coolify Environment Variables

Some Coolify versions need environment variables for SSL:

```bash
# Check Coolify environment
sudo docker inspect coolify | grep -A 20 "Env"
```

## Common Issues and Solutions

### Issue: Port 80 Already in Use
**Solution:** Coolify/Traefik is using it. This is normal. Don't stop it.

### Issue: DNS Not Propagated
**Solution:** Wait longer (up to 48 hours, usually 5-30 minutes)

### Issue: Let's Encrypt Rate Limits
**Solution:** Wait 1 hour if you've tried multiple times

### Issue: Traefik Not Provisioning SSL
**Solution:** Check Traefik logs for errors, may need manual certificate setup

