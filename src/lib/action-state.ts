export type FieldErrors = Record<string, string[]>;

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
  details?: string[];
  submissionId?: number;
};

export const INITIAL_ACTION_STATE: ActionState = {
  status: "idle",
};
