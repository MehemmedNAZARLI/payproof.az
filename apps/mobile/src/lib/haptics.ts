// A short tap of the vibration motor where the platform allows it. Android Chrome has the
// Vibration API; iOS Safari (18+) has none, but toggling a native `switch` checkbox plays the
// system's selection haptic, so that stands in there. Never required for meaning: every haptic
// accompanies something visible.

type Kind = "success" | "warning" | "tap";
const PATTERN: Record<Kind, number[]> = { success: [12, 60, 24], warning: [30, 50, 30], tap: [8] };

let iosSwitch: HTMLLabelElement | undefined;

function iosTap() {
  if (!iosSwitch) {
    iosSwitch = document.createElement("label");
    iosSwitch.ariaHidden = "true";
    iosSwitch.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.tabIndex = -1;
    input.setAttribute("switch", "");
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

export function haptic(kind: Kind) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate === "function") {
    // Before the page has had a tap Chrome blocks vibrate() and logs an error (a pull can come
    // first on a freshly opened page).
    if (navigator.userActivation?.hasBeenActive === false) return;
    navigator.vibrate(PATTERN[kind]);
    return;
  }
  if (/iPhone|iPad/.test(navigator.userAgent)) {
    iosTap();
    // A success reads as two taps on iOS, as the system's own success haptic does.
    if (kind !== "tap") setTimeout(iosTap, 90);
  }
}
