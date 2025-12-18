import React from "react";
import { cn } from "@/lib/utils";

interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
}

export const BrandIcon = ({ name, className, ...props }: BrandIconProps) => {
  const [svgContent, setSvgContent] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSvg = async () => {
      try {
        const response = await fetch(`/icons/${name}.svg`);
        if (response.ok) {
          const text = await response.text();
          // Remove the <svg> wrapper or extract the path to render it more flexibly
          // For simplicity, we'll just use the raw SVG content and inject it
          setSvgContent(text);
        }
      } catch (error) {
        console.error(`Failed to load icon: ${name}`, error);
      }
    };

    fetchSvg();
  }, [name]);

  if (!svgContent) {
    return <div className={cn("animate-pulse bg-muted rounded", className)} />;
  }

  // Basic cleanup of the SVG to make it styleable via className (fill="currentColor")
  const processedSvg = svgContent
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/fill="[^"]*"/g, 'fill="currentColor"');

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-4 w-4", className)}
      dangerouslySetInnerHTML={{ __html: processedSvg }}
      {...props}
    />
  );
};

