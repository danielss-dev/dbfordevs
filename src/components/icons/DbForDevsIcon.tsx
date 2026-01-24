import { SVGProps } from "react";

interface DbForDevsIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function DbForDevsIcon({ size, className, ...props }: DbForDevsIconProps) {
  const sizeValue = size ?? 24;

  return (
    <svg
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Database cylinder - top ellipse */}
      <ellipse cx="12" cy="5" rx="8" ry="2.5" />
      {/* Database cylinder - body */}
      <path d="M4 5v14c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5" />
      {/* Infinity symbol */}
      <path d="M8 14.5c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5c2 0 3 1.5 4 2.5 1-1 2-2.5 4-2.5 1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5c-2 0-3-1.5-4-2.5-1 1-2 2.5-4 2.5z" />
    </svg>
  );
}
