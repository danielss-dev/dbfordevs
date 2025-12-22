import { forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";

interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, checked: initialChecked, ...props }, ref) => {
    const { appStyle } = useUIStore();
    const [isChecked, setIsChecked] = useState(initialChecked as boolean);

    useEffect(() => {
      setIsChecked(initialChecked as boolean);
    }, [initialChecked]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;
      setIsChecked(newChecked);
      onCheckedChange?.(newChecked);
      onChange?.(e);
    };

    const handleClick = () => {
      const newChecked = !isChecked;
      setIsChecked(newChecked);
      onCheckedChange?.(newChecked);
      if (ref && "current" in ref && ref.current) {
        ref.current.checked = newChecked;
      }
    };

    const isWebStyle = appStyle === "web";

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          onChange={handleChange}
          checked={isChecked}
          className="sr-only"
          {...props}
        />
        <div
          className={cn(
            "h-5 w-5 border-2 transition-all duration-200 flex items-center justify-center cursor-pointer",
            isWebStyle ? "rounded-lg" : "rounded-md",
            isChecked
              ? "bg-primary border-primary"
              : "border-muted-foreground/30 hover:border-muted-foreground/50"
          )}
          onClick={handleClick}
        >
          {isChecked && (
            <svg
              className="h-3 w-3 text-primary-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
