import { CredentialsSignin } from "next-auth";

export class LoginRateLimitError extends CredentialsSignin {
  code = "rate_limited";
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super();
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AccountInactiveError extends CredentialsSignin {
  code = "account_inactive";
}
