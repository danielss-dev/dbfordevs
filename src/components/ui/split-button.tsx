import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SplitButtonItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface SplitButtonProps extends Omit<ButtonProps, "onClick"> {
  onPrimaryClick: () => void;
  dropdownItems: SplitButtonItem[];
  dropdownDisabled?: boolean;
}

const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(
  (
    {
      children,
      onPrimaryClick,
      dropdownItems,
      disabled,
      dropdownDisabled,
      className,
      variant,
      size,
      ...props
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn("inline-flex items-center", className)}>
        {/* Primary action button */}
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          onClick={onPrimaryClick}
          className="rounded-r-none border-r-0"
          {...props}
        >
          {children}
        </Button>

        {/* Dropdown trigger */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={disabled || dropdownDisabled}
              className="rounded-l-none px-2"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {dropdownItems.map((item, index) => (
              <DropdownMenuItem
                key={index}
                onClick={item.onClick}
                disabled={item.disabled}
              >
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

SplitButton.displayName = "SplitButton";

export { SplitButton };
