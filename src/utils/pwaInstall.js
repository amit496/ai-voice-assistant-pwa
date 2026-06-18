export function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function getInstallInstructions() {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg/i.test(ua);

  if (isIOS || isSafari) {
    return {
      platform: "ios",
      title: "Add Nova to Home Screen",
      steps: [
        "Tap the Share button in Safari (square with an arrow).",
        'Choose "Add to Home Screen".',
        'Tap "Add" to install Nova.',
      ],
    };
  }

  return {
    platform: "desktop",
    title: "Install from browser menu",
    steps: [
      "Look for the install icon in the address bar (⊕ or monitor icon), or",
      'Open the browser menu (⋮) and choose "Install Nova" / "Install app".',
      "Confirm installation when prompted.",
    ],
  };
}
