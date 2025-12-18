import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ValidationResult, ValidatorInfo } from "@/types";

interface ValidateRequest {
  validatorId: string;
  connectionString: string;
}

/**
 * Hook for connection string validation operations
 */
export function useValidator() {
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * List all available validators
   */
  const listValidators = useCallback(async (): Promise<ValidatorInfo[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<ValidatorInfo[]>("list_validators");
      setValidators(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Validate a connection string using the specified validator
   */
  const validateConnectionString = useCallback(
    async (
      validatorId: string,
      connectionString: string
    ): Promise<ValidationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const request: ValidateRequest = {
          validatorId,
          connectionString,
        };

        const result = await invoke<ValidationResult>(
          "validate_connection_string",
          { request }
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    validators,
    isLoading,
    error,
    listValidators,
    validateConnectionString,
  };
}

