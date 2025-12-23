import { useRef, useEffect } from "react";
import { Button } from "./button";
import { useAnime } from "@/hooks/useAnime";
import type { ButtonProps } from "./button";

export interface AnimatedButtonProps extends ButtonProps {
  animateOnMount?: boolean;
}

export function AnimatedButton({
  animateOnMount = false,
  children,
  onClick,
  ...props
}: AnimatedButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { animate } = useAnime();

  useEffect(() => {
    if (animateOnMount && buttonRef.current) {
      animate({
        targets: buttonRef.current,
        scale: [0.9, 1],
        opacity: [0, 1],
        duration: 400,
        easing: "easeOutElastic(1, .6)",
      });
    }
  }, [animateOnMount, animate]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
      animate({
        targets: buttonRef.current,
        scale: [1, 0.95, 1],
        duration: 200,
        easing: "easeInOutQuad",
      });
    }
    onClick?.(e);
  };

  return (
    <Button ref={buttonRef} onClick={handleClick} {...props}>
      {children}
    </Button>
  );
}
