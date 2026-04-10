# ChatGPT Memo

Simple memo app for saving and browsing ChatGPT notes.

## Features

- Add, edit, and delete memos
- Load saved memo data
- Import and export JSON files
- Installable as a PWA

## Run Locally

On Windows PowerShell, `npm` may be blocked by execution policy. If that happens, use:

```powershell
npm.cmd start
```

Then open:

- `http://localhost:4173`

## Deploy To A VPS

This app does not need a build step. Install Node.js, clone the repo, and keep `server.js` running.

### 1. Connect with SSH

```bash
ssh root@<your-vps-ip>
```

### 2. Install Node.js and Git

For Ubuntu or Debian:

```bash
apt update
apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

### 3. Clone the app

```bash
cd /var/www
git clone https://github.com/summerMK-ops/Memogpt.git
cd Memogpt
```

### 4. Test the app

```bash
npm install
PORT=4173 npm start
```

Open:

- `http://<your-vps-ip>:4173`

### 5. Keep it running with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Useful checks:

```bash
pm2 status
pm2 logs chatgpt-memo
```

### 6. Open the port

If you use `ufw`:

```bash
ufw allow 4173/tcp
ufw status
```

### 7. Update later

```bash
cd /var/www/Memogpt
git pull origin main
pm2 restart chatgpt-memo
```

## Optional Next Step

For production, it is better to put Nginx in front and serve the app from a domain with HTTPS.
