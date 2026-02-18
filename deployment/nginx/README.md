# Nginx Configuration (Pilot App EC2)

Copy `ayryx-pilot.conf` to `/etc/nginx/conf.d/` on the Pilot App EC2.

```bash
sudo cp deployment/nginx/ayryx-pilot.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx
```

**SSL:** Ensure the cert covers ein.ayryx.com. Use a Cloudflare Origin Certificate for `*.ayryx.com` and save as `pilot.ayryx.com.pem`, or add ein.ayryx.com to the cert.

## Host header (multi-airline subdomains)

The app derives airline from the request Host (e.g. ein.ayryx.com → ein). If ein.ayryx.com shows the wrong instance, the Host (or X-Forwarded-Host) reaching the app is wrong.

**Debug:** Visit `https://ein.ayryx.com/api/debug-headers` to see exactly what headers the server receives.

**Common cause:** Cloudflare or another proxy overwriting Host. In Cloudflare:
- Check **Origin Rules** for any Host header override
- Check **Transform Rules** — ensure the original request host is forwarded
- By default Cloudflare forwards the client’s Host; verify no rules override it

**nginx:** The config uses `proxy_set_header Host $host` and `X-Forwarded-Host $host`, so nginx passes through whatever it receives. The fix is upstream (Cloudflare/origin config).
