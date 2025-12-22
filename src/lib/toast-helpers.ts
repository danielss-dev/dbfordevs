import { toast } from "@/hooks";

/**
 * Show a success toast notification
 */
export function showSuccessToast(title: string, description?: string) {
  toast({
    title,
    description,
    variant: "success",
  });
}

/**
 * Show an error toast notification
 */
export function showErrorToast(title: string, description?: string) {
  toast({
    title,
    description,
    variant: "destructive",
  });
}

/**
 * Show an info toast notification (default variant)
 */
export function showInfoToast(title: string, description?: string) {
  toast({
    title,
    description,
  });
}

/**
 * Show a toast for a successful operation with a standard format
 */
export function showOperationSuccessToast(operation: string, itemName?: string, details?: string) {
  const description = itemName
    ? `${itemName} has been ${operation} successfully.${details ? ` ${details}` : ""}`
    : `Operation ${operation} successfully.${details ? ` ${details}` : ""}`;

  showSuccessToast(
    `${operation.charAt(0).toUpperCase() + operation.slice(1)}${itemName ? ` ${itemName}` : ""}`,
    description
  );
}

/**
 * Show a toast for a failed operation with error handling
 */
export function showOperationErrorToast(operation: string, error: unknown, itemName?: string) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const title = `Failed to ${operation}${itemName ? ` ${itemName}` : ""}`;

  showErrorToast(title, errorMessage);
}

/**
 * Helper to handle try/catch with toast notifications for operations
 */
export async function executeWithToast<T>(
  operation: () => Promise<T>,
  {
    successTitle,
    successDescription,
    errorTitle,
    errorDescription,
  }: {
    successTitle?: string;
    successDescription?: string;
    errorTitle: string;
    errorDescription?: string;
  }
): Promise<T | undefined> {
  try {
    const result = await operation();

    if (successTitle) {
      showSuccessToast(successTitle, successDescription);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorToast(errorTitle, errorDescription || errorMessage);
    throw error;
  }
}
