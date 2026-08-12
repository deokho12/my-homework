export function formatWon(amount: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(amount)}원`;
}

export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatWon(min);
  return `${formatWon(min)} ~ ${formatWon(max)}`;
}

export function calcDiscountRate(originalPrice: number, salePrice: number): number {
  return Math.round((1 - salePrice / originalPrice) * 100);
}
