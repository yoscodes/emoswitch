/** 表示用の料金（円）。Stripe の Price ID と別途紐づけます。 */
export const PLAN_MONTHLY_JPY = {
  unlimited: 2980,
} as const;

export const YEARLY_DISCOUNT = 0.2;

export function yearlyTotalJpy(monthly: number): number {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
}

export function yearlyMonthlyEquivalentJpy(monthly: number): number {
  return Math.round(yearlyTotalJpy(monthly) / 12);
}
