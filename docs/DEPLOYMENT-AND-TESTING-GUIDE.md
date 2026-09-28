# MyAIDoctor.io — Inbound & Outbound Communication Setup Guide

> **Complete step-by-step guide to deploy and test real inbound calls, outbound SMS, voice AI calls, and patient messaging in a live environment.**

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Expose Your Server to the Internet](#2-expose-your-server-to-the-internet)
3. [Set Up Telnyx (Phone & SMS Provider)](#3-set-up-telnyx-phone--sms-provider)
4. [Configure MyAIDoctor Settings](#4-configure-myaidoctor-settings)
5. [Test Outbound SMS](#5-test-outbound-sms)
6. [Test Inbound Calls](#6-test-inbound-calls)
7. [Set Up Vapi.ai for AI Voice Calls](#7-set-up-vapiai-for-ai-voice-calls)
8. [Test Outbound AI Voice Calls](#8-test-outbound-ai-voice-calls)
9. [Test the Complete Patient Journey](#9-test-the-complete-patient-journey)
10. [Production Deployment](#10-production-deployment)
11. [Cost Summary](#11-cost-summary)
12. [Troubleshooting](#12-troubleshooting)
13. [Webhook Reference](#13-webhook-reference)

---

## 1. Prerequisites

Before you begin, ensure you have the following:

- MyAIDoctor application running (`npm run dev` on port 3000)
- A personal cell phone for testing
- A credit/debit card (for Telnyx — pay-as-you-go, no contracts)
- Node.js and npm installed on your server

### Verify the application is running

```bash
cd ~/projects/myaidoctor
npm run dev
```

Open `http://localhost:3000` in your browser and confirm the login page loads.

---

## 2. Expose Your Server to the Internet

Telnyx needs to reach your server via a public URL. Choose one of these options:

### Option A: Public Server (VPS / Cloud — Recommended for Production)

If your server has a public IP address:

```bash
# Check your public IP
curl ifconfig.me
```

If you get an IP (e.g., `34.56.78.90`):

```bash
# Open port 3000 in firewall
sudo ufw allow 3000

# Your webhook base URL is:
# http://34.56.78.90:3000
```

Update your `.env` file:

```env
NEXTAUTH_URL=http://34.56.78.90:3000
```

### Option B: Localtunnel (Free — Good for Testing)

If you're behind a home router or NAT:

```bash
# Run this — no installation needed
npx localtunnel --port 3000
```

You'll get a URL like `https://wild-fish-42.loca.lt`. Update `.env`:

```env
NEXTAUTH_URL=https://wild-fish-42.loca.lt
```

> **Note:** Localtunnel URLs change every time you restart. For stable testing, use a cloud server.

### Option C: Cloud Server (Cheapest Options)

| Provider | Cost | Link |
|---|---|---|
| Oracle Cloud | **Free forever** | cloud.oracle.com |
| Hetzner | $3.29/mo | hetzner.com |
| Vultr | $3.50/mo | vultr.com |
| DigitalOcean | $4/mo | digitalocean.com |

After provisioning, SSH in, clone your project, install dependencies, and run. No tunnel needed.

### Option D: DNS Fix (if downloads fail)

If your server has DNS resolution issues:

```bash
# Add Google DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
echo "nameserver 8.8.4.4" | sudo tee -a /etc/resolv.conf

# Verify DNS works
ping google.com
```

### Restart the application

After updating `.env`:

```bash
rm -rf .next
npm run dev
```

> **Important:** Write down your public URL. You'll use it as `{BASE_URL}` throughout this guide.

---

## 3. Set Up Telnyx (Phone & SMS Provider)

Telnyx is the cheapest provider for SMS and voice — roughly half the cost of Twilio.

### 3.1 Create a Telnyx Account

1. Go to **[telnyx.com](https://telnyx.com)**
2. Click **Sign Up**
3. Verify your email
4. Add a payment method (pay-as-you-go, no minimums)
5. You receive **$2 free credit** — enough for 500 SMS or 400 minutes

### 3.2 Get Your API Key

1. In the Telnyx Portal, go to **API Keys** (left sidebar under "Auth")
2. Click **Create API Key**
3. Name it "MyAIDoctor"
4. Copy the key — it starts with `KEY_...`

> **Save this key securely. You won't be able to see it again.**

### 3.3 Buy a Phone Number

1. Go to **Numbers → Search & Buy**
2. Search for a number:
   - Country: United States
   - Area code: Your preferred area code (e.g., `248` for Michigan)
   - Features: Check **SMS** and **Voice**
3. Buy the number — **$1.00/month**
4. Copy the full number (e.g., `+12485559000`)

### 3.4 Create a Messaging Profile

1. Go to **Messaging → Messaging Profiles**
2. Click **Add New Profile**
3. Name: `MyAIDoctor`
4. Under **Inbound Settings**:
   - Webhook URL: `{BASE_URL}/api/messaging`
   - Failover URL: leave blank
5. Click **Save**
6. Go to **Numbers → My Numbers**
7. Click your number → assign it to the "MyAIDoctor" messaging profile

### 3.5 Create a Voice Connection

1. Go to **Voice → Connections**
2. Click **Add Connection**
3. Connection Type: **Credentials**
4. Name: `MyAIDoctor`
5. Under **Inbound**:
   - Webhook URL: `{BASE_URL}/api/inbound-call`
   - Method: POST
6. Click **Save**
7. Go to **Numbers → My Numbers**
8. Click your number → under Voice, select the "MyAIDoctor" connection

### 3.6 Verify Configuration

Your Telnyx setup should look like this:

```
Phone Number: +12485559000
├── Messaging Profile: MyAIDoctor
│   └── Webhook: {BASE_URL}/api/messaging
└── Voice Connection: MyAIDoctor
    └── Webhook: {BASE_URL}/api/inbound-call
```

---

## 4. Configure MyAIDoctor Settings

### 4.1 Update Environment Variables

Edit your `.env` file:

```env
# Server URL (your public URL from Step 2)
NEXTAUTH_URL=https://your-public-url.com

# Telnyx Configuration
SMS_PROVIDER=telnyx
TELNYX_API_KEY=KEY_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELNYX_PHONE_NUMBER=+12485559000
```

### 4.2 Configure via Super Admin UI

1. Login as Super Admin (`superadmin@myaidoctor.io` / `MyAIDoc2024!`)
2. Go to **Super Admin → Settings**
3. Click **Locked** to unlock

**SMS / Messaging tab:**
- Select **Telnyx**
- API Key: paste your `KEY_...`
- Phone Number: `+12485559000`

**Voice AI tab:**
- Select **Vapi.ai** (we'll set this up in Step 7)
- Leave blank for now

4. Click **Save All Settings**

### 4.3 Restart the Application

```bash
rm -rf .next
npm run dev
```

---

## 5. Test Outbound SMS

### 5.1 Update Test Patient Phone Number

First, update Jane Smith's phone number to YOUR real cell phone so you receive the SMS:

1. Login as Super Admin
2. Go to **Super Admin → Users** (or directly edit the seed)
3. Or re-seed with your phone number in `scripts/seed.js`:

```javascript
// Find the Jane Smith patient record and change phone to your number
phone: "(YOUR) REAL-PHONE",  // e.g., "(313) 555-7890"
```

Then re-seed:

```bash
npx prisma db push --force-reset
node scripts/seed.js
npm run dev
```

### 5.2 Send a Test SMS

1. Login as a provider or admin
2. Go to **Send Patient Link** in the sidebar
3. Search for "Jane Smith"
4. Select **Pre-Visit Intake**
5. Select **SMS** channel
6. Click **Send**

### 5.3 Verify

- Check your cell phone — you should receive an SMS from your Telnyx number
- The SMS contains a link like `https://your-url.com/m/abc123...`
- Tap the link — it opens the pre-visit intake chat interface

### 5.4 If SMS Doesn't Arrive

Check the server console for errors:

```bash
# Look for SMS-related logs
# Common issues:
# - "Invalid phone number format" → use E.164 format (+1XXXXXXXXXX)
# - "Authentication failed" → check API key
# - "Number not found" → assign number to messaging profile
```

---

## 6. Test Inbound Calls

### 6.1 Make a Test Call

1. From your personal cell phone, **call your Telnyx number** (e.g., +12485559000)
2. Let it ring for 5-10 seconds, then hang up
3. Telnyx sends the call data to your webhook

### 6.2 Check the Dashboard

1. Login to MyAIDoctor
2. Go to **Inbound Calls** in the sidebar
3. You should see your call appear with:
   - Your cell phone number
   - Status: "New" or "Identified" (if your number matches a patient)
   - Time of call

### 6.3 Process the Call

1. Click the call to expand it
2. Select a service (e.g., "Medication Refill")
3. Click **Send Link**
4. You receive an SMS on your cell phone with the service link

### 6.4 Test with Voicemail/Transcript

If your Telnyx voice connection supports transcription:

1. Call the number and leave a message: "Hi, I need to refill my blood pressure medication"
2. The system auto-detects the intent as "Medication Refill"
3. If your number matches a patient, it auto-sends the refill link

> **Note:** Basic Telnyx voice connections forward call metadata but may not include transcription. For full voicemail transcription, configure Telnyx's Call Recording + Transcription feature or use Vapi.ai.

---

## 7. Set Up Vapi.ai for AI Voice Calls

Vapi.ai handles the AI conversation over the phone — the bot actually talks to the patient.

### 7.1 Create a Vapi.ai Account

1. Go to **[vapi.ai](https://vapi.ai)**
2. Sign up (free tier includes test minutes)
3. Dashboard → **Settings** → copy your **API Key**

### 7.2 Add a Phone Number

**Option A: Import from Telnyx**
1. Vapi Dashboard → **Phone Numbers** → **Import**
2. Select Telnyx → enter your API Key
3. Select your number

**Option B: Buy a Vapi Number**
1. Vapi Dashboard → **Phone Numbers** → **Buy**
2. Choose a number — $2/month
3. Copy the **Phone Number ID**

### 7.3 Configure Webhook

1. Vapi Dashboard → **Account Settings** → **Webhooks**
2. Add webhook URL: `{BASE_URL}/api/voice-call`
3. Enable: "End of Call Report"

### 7.4 Configure in MyAIDoctor

1. Super Admin → Settings → Voice AI tab → Unlock
2. Select **Vapi.ai**
3. API Key: paste from Vapi dashboard
4. Phone Number ID: paste from Vapi dashboard
5. Save

### 7.5 Update .env

```env
VOICE_PROVIDER=vapi
VAPI_API_KEY=your_vapi_api_key_here
```

Restart: `rm -rf .next && npm run dev`

---

## 8. Test Outbound AI Voice Calls

### 8.1 Trigger a Call from the Patient Portal

1. Login as Jane Smith (`jane.smith@email.com` / `MyAIDoc2024!`)
2. Go to **Patient Portal → Pre-Visit Intake**
3. Click **Start Intake** on an appointment
4. Choose **Phone Call**
5. Enter your real cell phone number
6. Click **Call Me Now**

### 8.2 What Happens

1. Your phone rings
2. The AI assistant greets you: "Hi there! I'm your MyAIDoctor pre-visit assistant..."
3. It walks through the 10-phase intake conversationally
4. When done, the transcript is saved
5. A SOAP note is generated
6. The provider can see it in Pre-Visit Briefs

### 8.3 Trigger a Call from the Dashboard

1. Login as admin/provider
2. Go to **Send Patient Link**
3. Search patient → select a service
4. Instead of SMS, the system can trigger a voice call via the API:

```bash
curl -X POST {BASE_URL}/api/voice-call \
  -H "Content-Type: application/json" \
  -d '{
    "action": "call",
    "appointmentId": "APPOINTMENT_ID",
    "phoneNumber": "+13135557890"
  }'
```

---

## 9. Test the Complete Patient Journey

Run through the entire flow end-to-end:

### Journey 1: Outbound SMS → Patient Intake

```
Admin sends SMS link → Patient receives SMS → Taps link →
Opens chat on phone → Completes intake → SOAP note generated →
Provider sees brief in Pre-Visit Briefs
```

### Journey 2: Inbound Call → Auto-Route

```
Patient calls clinic number → System identifies patient by phone →
Detects intent from voicemail → Auto-sends service link via SMS →
Patient taps link → Completes service → Data saved
```

### Journey 3: AI Voice Call → Intake

```
Patient chooses "Phone Call" in portal → AI calls patient →
Conducts intake conversation → Transcript saved → SOAP generated →
FHIR R4 bundle created → Pushed to EMR
```

### Journey 4: QR Code → In-Clinic Service

```
Patient scans QR code in waiting room → Enters phone number →
System identifies patient → Opens service chat on phone →
Completes pre-visit intake while waiting
```

### Journey 5: Agentic AI → Automated Outreach

```
Admin runs Agentic AI analysis → System scans all patients →
Identifies who needs what service → Sends SMS links in sequence →
Each link activates after the previous is completed
```

---

## 10. Production Deployment

### 10.1 Get a Domain

Purchase a domain (e.g., `app.myaidoctor.io`) from Namecheap, Cloudflare, or GoDaddy.

### 10.2 Set Up a Cloud Server

```bash
# Example: DigitalOcean or Hetzner
# Provision Ubuntu 24.04 server
# SSH in and install dependencies

sudo apt update
sudo apt install -y nodejs npm postgresql nginx certbot python3-certbot-nginx

# Clone your project
git clone your-repo-url ~/myaidoctor
cd ~/myaidoctor
npm install
```

### 10.3 Configure PostgreSQL

```bash
sudo -u postgres createuser myaidoctor
sudo -u postgres createdb myaidoctor -O myaidoctor
sudo -u postgres psql -c "ALTER USER myaidoctor PASSWORD 'secure_password';"
```

Update `.env`:

```env
DATABASE_URL="postgresql://myaidoctor:secure_password@localhost:5432/myaidoctor"
NEXTAUTH_URL=https://app.myaidoctor.io
NEXTAUTH_SECRET=generate_a_random_64_char_string
```

### 10.4 Build and Run

```bash
npx prisma generate
npx prisma db push
node scripts/seed.js
npm run build

# Install PM2
npm install -g pm2
pm2 start npm --name myaidoctor -- start
pm2 save
pm2 startup
```

### 10.5 Configure Nginx + SSL

```nginx
# /etc/nginx/sites-available/myaidoctor
server {
    server_name app.myaidoctor.io;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/myaidoctor /etc/nginx/sites-enabled/
sudo certbot --nginx -d app.myaidoctor.io
sudo systemctl restart nginx
```

### 10.6 Update Telnyx Webhooks

Replace all tunnel URLs with your production domain:

- Messaging webhook: `https://app.myaidoctor.io/api/messaging`
- Voice webhook: `https://app.myaidoctor.io/api/inbound-call`
- Vapi webhook: `https://app.myaidoctor.io/api/voice-call`

---

## 11. Cost Summary

### Per-Message / Per-Minute Costs

| Service | Provider | Cost |
|---|---|---|
| SMS outbound | Telnyx | $0.004/message |
| SMS inbound | Telnyx | $0.004/message |
| Voice inbound | Telnyx | $0.005/minute |
| Voice outbound | Telnyx | $0.005/minute |
| AI Voice call | Vapi.ai | $0.05/minute |
| Phone number | Telnyx | $1.00/month |
| AI (chat) | Anthropic | ~$0.02-0.04/intake |

### Monthly Estimate (100 patients/day)

| Item | Calculation | Cost |
|---|---|---|
| Phone number | 1 × $1 | $1 |
| Outbound SMS | 100/day × 30 × $0.004 | $12 |
| Inbound calls | 50/day × 30 × 2min × $0.005 | $15 |
| AI voice calls | 20/day × 30 × 10min × $0.05 | $300 |
| AI chat (Claude) | 80/day × 30 × $0.03 | $72 |
| **Total** | | **~$400/month** |

> Without AI voice calls (chat only): **~$100/month**

---

## 12. Troubleshooting

### SMS not sending

```bash
# Check server logs for errors
# Common issues:

# 1. API key invalid
# → Regenerate in Telnyx Portal → API Keys

# 2. Phone number not assigned to messaging profile
# → Telnyx → Numbers → My Numbers → assign profile

# 3. Number format wrong
# → Must be E.164: +12485559000 (not (248) 555-9000)

# 4. Free trial limitations
# → Telnyx trial may only send to verified numbers
# → Add your cell as a verified number in Telnyx settings
```

### Inbound calls not appearing

```bash
# 1. Check webhook URL is correct
# → Must be your public URL + /api/inbound-call

# 2. Check server is reachable
curl https://your-url.com/api/inbound-call

# 3. Check Telnyx voice connection
# → Numbers → your number → Voice must point to your connection

# 4. Check firewall
sudo ufw status
sudo ufw allow 3000
```

### Voice AI calls not connecting

```bash
# 1. Vapi.ai API key correct?
# 2. Phone number imported/assigned in Vapi?
# 3. Webhook URL set in Vapi dashboard?
# 4. Check Vapi call logs in their dashboard
```

### Patient not identified by phone

```bash
# The system matches by last 4 digits then verifies full number
# Make sure the patient's phone in the database matches your test phone
# Check: Super Admin → Users or the patients table
```

---

## 13. Webhook Reference

### Inbound Call Webhook

**URL:** `POST /api/inbound-call`

Telnyx sends this when someone calls your number:

```json
{
  "action": "webhook",
  "from": "+13135557890",
  "to": "+12485559000",
  "event": "call.received",
  "duration": 15,
  "transcript": "I need to refill my medication"
}
```

### Messaging Webhook

**URL:** `POST /api/messaging`

Telnyx sends this for SMS delivery status:

```json
{
  "action": "delivery_status",
  "to": "+13135557890",
  "status": "delivered"
}
```

### Voice Call Webhook (Vapi.ai)

**URL:** `POST /api/voice-call`

Vapi sends this when an AI call ends:

```json
{
  "message": {
    "type": "end-of-call-report",
    "transcript": "Full conversation transcript...",
    "duration": 600,
    "metadata": { "appointmentId": "..." }
  }
}
```

---

## Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║  MyAIDoctor Communication Setup                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Telnyx Portal:    portal.telnyx.com                        ║
║  Vapi Dashboard:   dashboard.vapi.ai                        ║
║  MyAIDoctor:       {BASE_URL}                               ║
║                                                              ║
║  Webhooks:                                                   ║
║    Inbound calls:  {BASE_URL}/api/inbound-call              ║
║    SMS delivery:   {BASE_URL}/api/messaging                 ║
║    Voice AI:       {BASE_URL}/api/voice-call                ║
║                                                              ║
║  Test Logins:                                                ║
║    Super Admin:    superadmin@myaidoctor.io / MyAIDoc2024!  ║
║    Patient:        jane.smith@email.com / MyAIDoc2024!      ║
║                                                              ║
║  Support:          api@myaidoctor.io                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

*Document generated for MyAIDoctor.io v1.0 — Last updated: May 2026*
