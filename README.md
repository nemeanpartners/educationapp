<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/45fc46dd-a050-4690-b658-20c35dd2f99a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Google Sign-In Custom Domain

Firebase Auth is configured to use `edurevolution-ai-wyxvlktr5q-uw.a.run.app` as the auth domain. For Google sign-in to work on the Cloud Run app URL, the Google OAuth web client for Firebase must include this exact authorized redirect URI:

`https://edurevolution-ai-wyxvlktr5q-uw.a.run.app/__/auth/handler`

Also keep these domains authorized in Firebase Authentication:

`edurevolution-ai-wyxvlktr5q-uw.a.run.app`

To make the Google account chooser say "Continue to Education Revolution", update the OAuth consent screen/app branding in Google Cloud for project `studio-7677496479-873b4` so the app name is `Education Revolution`.
