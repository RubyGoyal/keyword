# Embee Keyword Lab

Internal keyword research tool for embee.co.in — unified SEO, AEO, and GEO intelligence for the Indian market.

## 🚀 Deploy to Vercel in 10 Minutes

### Step 1: Reset your DataForSEO password first

Because your current password was shared in chat, reset it before deploying:
1. Log in at https://app.dataforseo.com
2. Go to API Access → click "Reset API Password"
3. Save the new password — you'll need it in Step 4

### Step 2: Push this folder to GitHub

1. Create a new **private** repository on GitHub (important: keep it private)
2. In your terminal, from this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/embee-keyword-lab.git
git push -u origin main
```

### Step 3: Deploy on Vercel

1. Go to https://vercel.com and sign up (use your GitHub account for easy integration)
2. Click **"Add New → Project"**
3. Import the GitHub repo you just pushed
4. **Do NOT click Deploy yet** — first go to Environment Variables

### Step 4: Add environment variables

In the Vercel project setup page, scroll to **Environment Variables** and add:

| Name | Value |
|------|-------|
| `DATAFORSEO_LOGIN` | `ruby.goyal@embee.co.in` |
| `DATAFORSEO_PASSWORD` | `your_new_password_from_step_1` |

Then click **Deploy**.

### Step 5: Done!

After ~2 minutes you'll get a live URL like `embee-keyword-lab.vercel.app`. Share it with your team via Slack/email.

## 🔐 Security Model

✅ **Secure**: Your DataForSEO credentials live as environment variables on Vercel's server. They're used by the `/api/keywords` backend route but never sent to the user's browser.

✅ **Safe to share**: The URL can be shared with your team. Even if someone inspects the page source, they'll only see the frontend code — credentials stay server-side.

⚠️ **Still internal only**: Anyone who has the URL can use the tool, which means they can consume your DataForSEO API budget. Don't post the URL publicly. To add real authentication later, ask Claude for help with NextAuth or a password gate.

## 💰 Vercel Costs

The **Hobby plan is free forever** and more than covers Embee's internal team usage. No credit card required.

## 🔧 Local Development

If you want to test locally before deploying:

```bash
# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local
# Edit .env.local and paste your DataForSEO credentials

# Run locally
npm run dev
```

Open http://localhost:3000 in your browser.

## 📦 What's Inside

```
embee-keyword-lab/
├── app/
│   ├── api/keywords/route.js   # Backend API that proxies DataForSEO
│   ├── globals.css             # Global styles
│   ├── layout.js               # Root HTML layout
│   └── page.js                 # Homepage
├── components/
│   └── KeywordLab.js           # Main UI component
├── .env.example                # Template for env vars
├── .gitignore                  # Protects secrets from git
├── next.config.mjs             # Next.js config
├── package.json                # Dependencies
├── postcss.config.mjs          # PostCSS config
├── tailwind.config.js          # Tailwind config
└── README.md                   # This file
```

## 🎯 Features

- **India-locked targeting** (location code 2356)
- **6 Embee service lines** pre-loaded with seed keywords
- **4 research lenses**: SEO, AEO, GEO, Quick Wins
- **Smart tagging**: Embee-relevant, Local (India), GEO, Question
- **KD + Volume filters**
- **CPC in Indian Rupees** (₹)
- **CSV export**
- **Competitor monitoring** (Sonata, SoftwareOne, G7CR, Noventiq, HCLTech)

## 🆘 Troubleshooting

**"Server misconfigured: API credentials not set"**
→ Environment variables weren't added to Vercel. Go to Vercel project → Settings → Environment Variables → add them → redeploy.

**"DataForSEO error 401"**
→ Credentials are wrong. Double-check the login email and password in Vercel env vars.

**"DataForSEO error 402"**
→ Account balance is too low. Top up at https://app.dataforseo.com

**Build fails on Vercel**
→ Check that Node.js 18 or later is selected in Vercel settings.

## 📝 Future Enhancements

Want to add any of these? Just ask Claude:
- Password protection / team login
- Competitor gap analysis (keywords they rank for but you don't)
- Rank tracking for embee.co.in
- Google Search Console integration
- LLM visibility tracking (check if Embee appears in ChatGPT/Perplexity answers)
- Historical keyword volume trends
- Saved keyword lists

---

Built for Embee Software Pvt. Ltd. · Internal use only
