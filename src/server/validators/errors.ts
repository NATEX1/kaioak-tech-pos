import { z, type ZodError } from "zod";

import type { FieldErrors } from "@/lib/action-state";

export function fieldErrorsFrom(error: ZodError): FieldErrors {
  const flattened = z.flattenError(error).fieldErrors;
  const result: FieldErrors = {};

  for (const [key, messages] of Object.entries(flattened)) {
    if (Array.isArray(messages) && messages.length > 0) {
      result[key] = messages.filter(
        (message): message is string => typeof message === "string",
      );
    }
  }

  return result;
}
