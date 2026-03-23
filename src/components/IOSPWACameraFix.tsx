// src/components/IOSPWACameraFix.tsx
// Previously reloaded page on bfcache restoration (pageshow.persisted) to reset
// the camera session. This caused iOS to re-prompt for camera permission on every
// app resume. The reload is no longer needed because QRScannerModal now retries
// in-process when black frames are detected.
export default function IOSPWACameraFix() {
  return null;
}