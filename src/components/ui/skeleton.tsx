import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  );
}

// Preset skeleton components for common use cases
export function SkeletonText({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full", className)} {...props} />;
}

export function SkeletonHeading({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-6 w-3/4", className)} {...props} />;
}

export function SkeletonCircle({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-12 w-12 rounded-full", className)} {...props} />;
}

export function SkeletonButton({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-9 w-24 rounded-md", className)} {...props} />;
}
