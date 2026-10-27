-- Commission reversal entries carry negative amounts. A payout must be able to
-- settle those deductions alongside positive earnings, so payout items need to
-- preserve the sign even though each payout total remains non-negative.
ALTER TABLE "CommissionPayoutItem"
  DROP CONSTRAINT IF EXISTS "CommissionPayoutItem_amount_non_negative_check";
