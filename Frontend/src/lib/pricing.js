export const getDiscountedPrice = (product) => {
  if (!product) return null;

  const price = Number(product.price);
  if (!Number.isFinite(price)) return null;

  if (!product.discount || product.discount_percentage == null) return price;

  const percentage = Number(product.discount_percentage);
  if (!Number.isFinite(percentage)) return price;

  const clamped = Math.min(100, Math.max(0, percentage));
  const discounted = price * (1 - clamped / 100);

  return Number(discounted.toFixed(2));
};
