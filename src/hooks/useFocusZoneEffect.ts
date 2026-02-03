import { useEffect } from "react";
import { useFocusStore } from "@/stores/focus";

/**
 * Watches the active focus zone and:
 * 1. Focuses the first focusable element in the target zone
 * 2. Adds/removes `focus-zone-active` CSS class for visual ring indicator
 */
export function useFocusZoneEffect() {
  const activeZone = useFocusStore((s) => s.activeZone);

  useEffect(() => {
    // Remove active class from all zones
    const allZones = document.querySelectorAll("[data-focus-zone]");
    allZones.forEach((el) => el.classList.remove("focus-zone-active"));

    if (!activeZone) return;

    const zoneElement = document.querySelector(`[data-focus-zone="${activeZone}"]`);
    if (!zoneElement) return;

    // Add active class for visual indicator
    zoneElement.classList.add("focus-zone-active");

    // Focus the first focusable element within the zone
    const focusable = zoneElement.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusable.focus();
    } else {
      // If no focusable element, focus the zone container itself if it has tabIndex
      if ((zoneElement as HTMLElement).tabIndex >= 0) {
        (zoneElement as HTMLElement).focus();
      }
    }

    // Track clicks to detect when user moves focus manually
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // If focus moved outside the active zone, clear it
      if (!zoneElement.contains(target)) {
        // Find which zone the target is in
        const targetZone = target.closest("[data-focus-zone]");
        if (targetZone) {
          const zoneName = targetZone.getAttribute("data-focus-zone") as typeof activeZone;
          useFocusStore.getState().setActiveZone(zoneName);
        } else {
          useFocusStore.getState().setActiveZone(null);
        }
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      zoneElement.classList.remove("focus-zone-active");
    };
  }, [activeZone]);
}
