// README.md

# Deploy-ready Social Chat (React + Next.js + Firebase)

This repository is a minimal, deploy-ready social chat app that meets your requirements:

1. Users enter via a URL.
2. On entry they input a number (their ID) to identify themselves.
3. Users can post text messages.
4. Users see others' messages in real time.

Built with Next.js (React) and Firebase Firestore (real-time listeners). Deploy to Vercel for a frictionless experience.

---

## Features
- No signup: user identifies by entering a numeric ID.
- Realtime updates via Firestore `onSnapshot`.
- Simple, mobile-friendly UI using Tailwind CSS.
- Minimal env setup (Firebase config) — set these as Vercel environment variables for secure deployment.

---

## Files in this single-file bundle
The following files are included below (copy them into a project or use the GitHub repo you create):

- package.json
- tailwind.config.js
- postcss.config.js
- pages/_app.js
- pages/index.js
- lib/firebase.js
- styles/globals.css

---

## Required environment variables (set in Vercel or .env.local locally)

NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

---

## Quick setup
1. Create Firebase project and Firestore database (in test mode for development).
2. Enable Firestore (no auth required for this demo). For production please secure rules.
3. Create a Next.js project and paste the files below into respective files.
4. Install dependencies: `npm install`.
5. Run locally: `npm run dev`.
6. Deploy to Vercel and add environment variables listed above.

---
