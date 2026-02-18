# Nginx Configuration (Pilot App EC2)

Copy `ayryx-pilot.conf` to `/etc/nginx/conf.d/` on the Pilot App EC2.

```bash
sudo cp deployment/nginx/ayryx-pilot.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx
```

**SSL:** Ensure the cert covers ein.ayryx.com. Use a Cloudflare Origin Certificate for `*.ayryx.com` and save as `pilot.ayryx.com.pem`, or add ein.ayryx.com to the cert.
