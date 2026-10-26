"use strict";

const CUSTOM_AMOUNT_PAYMENT_TYPES = new Set(["pay_now", "donate"]);

function supportsCustomAmount(paymentType, enabled) {
  return enabled === true && CUSTOM_AMOUNT_PAYMENT_TYPES.has(String(paymentType || "").trim().toLowerCase());
}
function hasAmountInput(amount) { return amount !== undefined && amount !== null && amount !== ""; }
function isPositiveAmount(amount) { const value = Number(amount); return Number.isFinite(value) && value > 0; }
function validateProductAmountInput(paymentType, enabled, amount) {
  if (!supportsCustomAmount(paymentType, enabled)) return isPositiveAmount(amount);
  return !hasAmountInput(amount) || isPositiveAmount(amount);
}
function normalizeProductAmount(paymentType, enabled, amount) {
  if (supportsCustomAmount(paymentType, enabled)) return hasAmountInput(amount) ? Number(amount) : null;
  return Number(amount);
}
function resolveProductAmount(product, requestedAmount) {
  if (supportsCustomAmount(product && product.payment_type, product && product.allow_custom_amount)) return Number(requestedAmount);
  return Number(product && product.amount);
}
module.exports = { supportsCustomAmount, validateProductAmountInput, normalizeProductAmount, resolveProductAmount };
