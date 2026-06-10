/**
 * Formatting utilities for the application
 */

/**
 * Formats a number as Indian Currency (INR)
 * Example: 1000000 -> ₹10,00,000.00
 */
export const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₹0';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0, // Usually better for dashboard overviews
  }).format(num);
};

/**
 * Formats a number as compact Indian Currency (INR)
 * Example: 1000000 -> ₹10L
 */
export const formatCompactCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
};

/**
 * Formats a number with Indian thousand separators
 */
export const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-IN').format(num);
};
