export function adjustHitPoints(
  current: number,
  maximum: number,
  amount: number,
  action: "damage" | "heal",
): number {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Enter an amount greater than zero.");
  return action === "damage"
    ? Math.max(0, current - amount)
    : Math.min(maximum, current + amount);
}
