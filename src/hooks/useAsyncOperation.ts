import { useState } from "react";

export interface UseAsyncOperationOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UseAsyncOperationResult<T> {
  execute: (operation: () => Promise<T>) => Promise<T | undefined>;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Custom hook to handle async operations with loading and error states.
 * Eliminates boilerplate code for loading/error state management.
 *
 * @example
 * const { execute, isLoading, error } = useAsyncOperation();
 *
 * const handleSubmit = async () => {
 *   await execute(async () => {
 *     await someAsyncOperation();
 *   });
 * };
 */
export function useAsyncOperation<T = void>(
  options?: UseAsyncOperationOptions
): UseAsyncOperationResult<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (operation: () => Promise<T>): Promise<T | undefined> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      options?.onSuccess?.();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      options?.onError?.(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setError(null);
  };

  return {
    execute,
    isLoading,
    error,
    setError,
    reset,
  };
}
