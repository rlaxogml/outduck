import { CUSTOM_EVENTS } from "./constants";

export function triggerOpenMobileMenu() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_MOBILE_MENU));
  }
}
