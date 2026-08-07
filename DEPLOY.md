# Deploying the Museum to technophobic.space (HostGator)

Everything inside `site/` is the website. Nothing needs building, compiling, or
installing — it's plain HTML/CSS/JS and runs on any shared host.

## Option A — Replace the WordPress front page (recommended)

1. Connect to HostGator via FTP (or cPanel → File Manager) and open `public_html/`.
2. Upload the **contents** of `site/` (not the folder itself) into `public_html/`:
   - `index.html`, `style.css`, `script.js`, `favicon.svg`, `404.html`,
     `robots.txt`, `sitemap.xml`
   - the whole `xr/` folder (the WebXR dioramas — three.js is vendored inside
     it, nothing else to install)
3. WordPress serves `index.php`, so tell Apache to prefer `index.html`. Edit (or
   create) `public_html/.htaccess` and add these lines **at the very top**, above
   any `# BEGIN WordPress` block:

   ```
   DirectoryIndex index.html index.php
   ErrorDocument 404 /404.html
   ```

4. If WordPress already has a `robots.txt`/virtual robots, the uploaded file wins
   because it's a real file on disk. Same for sitemap.xml.

WordPress stays installed and untouched (admin still at `/wp-admin/`); it just no
longer owns the front page. To hand the front page back to WordPress later, remove
the `DirectoryIndex` line.

## Option B — Clean slate

If you'd rather drop WordPress entirely: back it up in cPanel, delete the WP files
from `public_html/`, and upload the contents of `site/`. Still add the
`ErrorDocument 404 /404.html` line to `.htaccess` so the themed 404 works.

## After deploying

- Visit https://technophobic.space/ — hard-refresh (Cmd+Shift+R) to skip cache.
- Check https://technophobic.space/404-test-anything to see the Luddite page.
- Optional: submit `https://technophobic.space/sitemap.xml` in Google Search
  Console when you feel like being findable.

## Notes on the dioramas (xr/)

- The 3D scenes work for everyone (drag/touch to orbit). The "Enter VR" button
  only appears on WebXR-capable browsers (Quest, Vision Pro, etc.) **and only
  over HTTPS** — make sure the domain's SSL certificate is active (HostGator
  AutoSSL usually handles this; check cPanel → SSL/TLS Status if not).
- Each scene is `xr/<name>.html` + `xr/scenes/<name>.js` on the shared engine
  (`xr/diorama.js`). Adding a scene never touches the existing ones.

## Notes

- The site sets no cookies and loads nothing except Google Fonts. If you ever
  want it fully self-hosted, the fonts (Fraunces, IBM Plex Mono) can be
  downloaded and served locally — say the word and I'll wire it up.
- `404.html` is marked `noindex`; the sitemap lists only the front page.
