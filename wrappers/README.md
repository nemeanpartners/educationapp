# Wrapper Apps

This directory contains isolated wrapper shells for the live EduRevolution AI deployment.

## iOS / iPadOS

`ios-shell/` is a Capacitor-based mobile shell that opens the live app in an in-app browser. This avoids the Google sign-in problems common with plain embedded webviews.

## macOS

`macos-shell/` is an Electron wrapper that loads the live app URL and can be packaged into a DMG.
