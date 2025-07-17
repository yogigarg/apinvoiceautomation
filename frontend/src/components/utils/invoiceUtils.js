// src/utils/invoiceUtils.js
// Global utilities for safely extracting invoice data

/**
 * Safely extract vendor name from invoice data
 * Handles both old string format and new object format
 */
export const safeGetVendorName = (invoiceData) => {
  if (!invoiceData) return 'N/A';
  
  const vendor = invoiceData.vendor;
  
  // Handle vendor as string (old format)
  if (typeof vendor === 'string') {
    return vendor || 'N/A';
  }
  
  // Handle vendor as object (new format)
  if (typeof vendor === 'object' && vendor !== null) {
    return vendor.name || 'Unknown Vendor';
  }
  
  return 'N/A';
};

/**
 * Safely extract vendor information object
 */
export const safeGetVendorInfo = (invoiceData) => {
  if (!invoiceData?.vendor) {
    return { name: 'N/A' };
  }
  
  if (typeof invoiceData.vendor === 'string') {
    return { name: invoiceData.vendor };
  }
  
  if (typeof invoiceData.vendor === 'object') {
    return {
      name: invoiceData.vendor.name || 'N/A',
      address: invoiceData.vendor.address || null,
      phone: invoiceData.vendor.phone || null,
      email: invoiceData.vendor.email || null,
      taxId: invoiceData.vendor.taxId || null
    };
  }
  
  return { name: 'N/A' };
};

/**
 * Safely extract total amount from invoice data
 */
export const safeGetTotalAmount = (invoiceData) => {
  if (!invoiceData) return null;
  
  // New nested structure
  if (invoiceData.amounts?.total !== undefined) {
    return invoiceData.amounts.total;
  }
  
  // Old flat structure
  if (invoiceData.total !== undefined) {
    return invoiceData.total;
  }
  
  return null;
};

/**
 * Safely extract currency from invoice data
 */
export const safeGetCurrency = (invoiceData) => {
  if (!invoiceData) return 'USD';
  
  if (invoiceData.amounts?.currency) {
    return invoiceData.amounts.currency;
  }
  
  if (invoiceData.currency) {
    return invoiceData.currency;
  }
  
  return 'USD';
};

/**
 * Format currency with proper symbol
 */
export const formatCurrencyWithSymbol = (amount, currency = 'USD') => {
  if (!amount || amount === null || amount === undefined) return 'N/A';
  
  const currencySymbols = {
    'USD': '$',
    'CAD': 'CAD $',
    'INR': '₹',
    'EUR': '€',
    'GBP': '£'
  };
  
  const symbol = currencySymbols[currency] || '$';
  const numericAmount = Number(amount);
  
  if (isNaN(numericAmount)) return 'N/A';
  
  return `${symbol}${numericAmount.toLocaleString()}`;
};

/**
 * Safely format currency from invoice data
 */
export const safeFormatCurrency = (invoiceData) => {
  const amount = safeGetTotalAmount(invoiceData);
  const currency = safeGetCurrency(invoiceData);
  return formatCurrencyWithSymbol(amount, currency);
};

/**
 * Get all amount details safely
 */
export const safeGetAmounts = (invoiceData) => {
  if (!invoiceData) {
    return {
      subtotal: null,
      tax: null,
      taxRate: null,
      total: null,
      amountPaid: null,
      balanceDue: null,
      currency: 'USD'
    };
  }
  
  // Handle new nested structure
  if (invoiceData.amounts) {
    return {
      subtotal: invoiceData.amounts.subtotal || null,
      tax: invoiceData.amounts.tax || null,
      taxRate: invoiceData.amounts.taxRate || null,
      total: invoiceData.amounts.total || null,
      amountPaid: invoiceData.amounts.amountPaid || null,
      balanceDue: invoiceData.amounts.balanceDue || null,
      currency: invoiceData.amounts.currency || 'USD'
    };
  }
  
  // Handle old flat structure
  return {
    subtotal: invoiceData.subtotal || null,
    tax: invoiceData.tax || null,
    taxRate: invoiceData.taxRate || null,
    total: invoiceData.total || null,
    amountPaid: invoiceData.amountPaid || null,
    balanceDue: invoiceData.balanceDue || null,
    currency: invoiceData.currency || 'USD'
  };
};

/**
 * Debug function to log invoice data structure
 */
export const debugInvoiceData = (invoiceData, componentName = 'Unknown') => {
  console.group(`🔍 Invoice Data Debug - ${componentName}`);
  console.log('Full data:', invoiceData);
  console.log('Vendor type:', typeof invoiceData?.vendor);
  console.log('Vendor value:', invoiceData?.vendor);
  console.log('Safe vendor name:', safeGetVendorName(invoiceData));
  console.log('Safe total amount:', safeGetTotalAmount(invoiceData));
  console.log('Safe currency:', safeGetCurrency(invoiceData));
  console.groupEnd();
  
  return invoiceData;
};

/**
 * React component wrapper for safe vendor display
 */
export const SafeVendorDisplay = ({ invoiceData, fallback = 'N/A' }) => {
  const vendorName = safeGetVendorName(invoiceData);
  return vendorName || fallback;
};

/**
 * React component wrapper for safe amount display
 */
export const SafeAmountDisplay = ({ invoiceData, fallback = 'N/A' }) => {
  const formattedAmount = safeFormatCurrency(invoiceData);
  return formattedAmount || fallback;
};

// Export all utilities
export default {
  safeGetVendorName,
  safeGetVendorInfo,
  safeGetTotalAmount,
  safeGetCurrency,
  formatCurrencyWithSymbol,
  safeFormatCurrency,
  safeGetAmounts,
  debugInvoiceData,
  SafeVendorDisplay,
  SafeAmountDisplay
};