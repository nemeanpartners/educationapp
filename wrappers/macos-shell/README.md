# EducationRev macOS Wrapper

This wrapper packages the live EducationRev web app as a macOS desktop shell.

## Build targets

- `npm run dist:dmg`
  - builds a standard macOS DMG for direct distribution
- `npm run dist:mas`
  - builds a Mac App Store package target
- `npm run dist:all`
  - builds both targets

## Important

`DMG` is for direct download distribution.

`Mac App Store` does **not** use a DMG upload. It requires:

- Apple Developer Program membership
- `3rd Party Mac Developer Application` signing identity
- `3rd Party Mac Developer Installer` signing identity
- a valid App Store provisioning profile

Place the provisioning profile at:

`build/EduRev.provisionprofile`

## Notes

- `main.js` loads the live production app:
  - `https://edurevolution-ai-wyxvlktr5q-uw.a.run.app/auth`
- `build/entitlements.mas.plist` and `build/entitlements.mas.inherit.plist`
  - are the App Store sandbox entitlements used for the `mas` target
- `build/entitlements.mac.plist`
  - is for the normal notarized/non-App-Store mac build path

## Local commands

```bash
cd wrappers/macos-shell
npm install
npm run dist:dmg
```

For App Store packaging:

```bash
cd wrappers/macos-shell
npm install
npm run dist:mas
```
