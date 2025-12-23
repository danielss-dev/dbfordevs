import { useEffect, useRef } from "react";
import { animate as animeAnimate } from "animejs";
import type { TargetsParam } from "animejs";
import { useUIStore } from "@/stores";

/**
 * Parameters for animejs animations
 */
interface AnimeAnimationParams {
  targets: TargetsParam;
  duration?: number;
  delay?: number;
  easing?: string;
  opacity?: number | number[];
  translateX?: number | number[];
  translateY?: number | number[];
  scale?: number | number[];
  rotate?: number | number[];
  [key: string]: any;
}

/**
 * Hook to use animejs with respect to the user's animation settings
 * Returns an animate function that only runs if animations are enabled
 */
export function useAnime() {
  const enableAnimations = useUIStore((state) => state.generalSettings.enableAnimations);

  const animate = ({ targets, ...params }: AnimeAnimationParams) => {
    if (!enableAnimations) {
      // If animations are disabled, skip to the end state immediately
      const targetElements = typeof targets === "string"
        ? document.querySelectorAll(targets)
        : Array.isArray(targets)
        ? targets
        : [targets];

      // Apply final values immediately
      const finalState: Record<string, any> = {};
      Object.keys(params).forEach((key) => {
        if (key !== "duration" && key !== "easing" &&
            key !== "delay" && key !== "endDelay" && key !== "loop" &&
            key !== "direction" && key !== "autoplay" && key !== "begin" &&
            key !== "update" && key !== "complete" && key !== "onRender") {
          const value = params[key];
          if (Array.isArray(value)) {
            finalState[key] = value[value.length - 1];
          } else {
            finalState[key] = value;
          }
        }
      });

      Array.from(targetElements).forEach((el: any) => {
        if (el && el.style) {
          Object.keys(finalState).forEach((prop) => {
            (el.style as any)[prop] = finalState[prop];
          });
        }
      });

      // Call complete callback if provided
      if (params.complete) {
        params.complete({} as any);
      }

      return { play: () => {}, pause: () => {}, restart: () => {}, reverse: () => {} };
    }

    return animeAnimate(targets, params as any);
  };

  return { animate, enableAnimations };
}

/**
 * Hook to animate an element on mount
 */
export function useAnimeOnMount(
  targetRef: React.RefObject<HTMLElement>,
  params: Omit<AnimeAnimationParams, "targets">
) {
  const { animate, enableAnimations } = useAnime();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!hasAnimated.current && targetRef.current && enableAnimations) {
      animate({
        targets: targetRef.current,
        ...params,
      });
      hasAnimated.current = true;
    }
  }, [enableAnimations, animate, params, targetRef]);
}
