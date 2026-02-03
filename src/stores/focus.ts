import { create } from "zustand";

export type FocusZone = "sidebar" | "editor" | "grid" | "panel" | null;

const ZONE_ORDER: FocusZone[] = ["sidebar", "editor", "grid", "panel"];

interface FocusState {
  activeZone: FocusZone;
  setActiveZone: (zone: FocusZone) => void;
  cycleZone: (direction: "forward" | "backward") => void;
}

export const useFocusStore = create<FocusState>()((set, get) => ({
  activeZone: null,

  setActiveZone: (zone) => set({ activeZone: zone }),

  cycleZone: (direction) => {
    const { activeZone } = get();
    const visibleZones = ZONE_ORDER.filter((zone) => {
      const el = document.querySelector(`[data-focus-zone="${zone}"]`);
      return el && (el as HTMLElement).offsetParent !== null;
    });

    if (visibleZones.length === 0) return;

    const currentIndex = activeZone ? visibleZones.indexOf(activeZone) : -1;
    let nextIndex: number;

    if (direction === "forward") {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % visibleZones.length;
    } else {
      nextIndex = currentIndex === -1 ? visibleZones.length - 1 : (currentIndex - 1 + visibleZones.length) % visibleZones.length;
    }

    set({ activeZone: visibleZones[nextIndex] });
  },
}));
