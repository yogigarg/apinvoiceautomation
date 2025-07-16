// src/utils/invoiceUtils.js - Safe extraction utilities to prevent vendor object errors

/**
 * Safely extract vendor name from invoice data
 * Handles both string and object vendor formats
 */
export const safeGetVendorName = (invoiceData) => {
    if (!invoiceData) return 'N/A';

    // Handle string vendor format (legacy)
    if (typeof invoiceData.vendor === 'string') {
        return invoiceData.vendor;
    }

    // Handle object vendor format (new)
    if (typeof invoiceData.vendor === 'object' && invoiceData.vendor?.name) {
        return invoiceData.vendor.name;
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

    // If vendor is a string, return it as name
    if (typeof invoiceData.vendor === 'string') {
        return { name: invoiceData.vendor };
    }

    // If vendor is an object, return it
    if (typeof invoiceData.vendor === 'object') {
        return invoiceData.vendor;
    }

    return { name: 'N/A' };
};

/**
 * Safely extract total amount from invoice data
 * Handles both old and new data structures
 */
export const safeGetTotalAmount = (invoiceData) => {
    if (!invoiceData) return null;

    // Check new structure first
    if (invoiceData.amounts?.total) {
        return invoiceData.amounts.total;
    }

    // Check legacy structure
    if (invoiceData.total) {
        return invoiceData.total;
    }

    return null;
};

/**
 * Safely extract currency from invoice data
 */
export const safeGetCurrency = (invoiceData) => {
    if (!invoiceData) return 'USD';

    // Check new structure first
    if (invoiceData.amounts?.currency) {
        return invoiceData.amounts.currency;
    }

    // Check legacy structure
    if (invoiceData.currency) {
        return invoiceData.currency;
    }

    return 'USD';
};

/**
 * Safely format currency with proper symbol and amount
 */
export const safeFormatCurrency = (amount, invoiceData) => {
    if (!amount || isNaN(amount)) return 'N/A';

    const currency = safeGetCurrency(invoiceData);
    const currencyMap = {
        'USD': '$',
        'CAD': 'CAD $',
        'INR': '₹',
        'EUR': '€',
        'GBP': '£'
    };

    const symbol = currencyMap[currency] || '$';
    return `${symbol}${amount.toLocaleString()}`;
};

/**
 * Safely extract subtotal amount
 */
export const safeGetSubtotal = (invoiceData) => {
    if (!invoiceData) return null;

    // Check new structure first
    if (invoiceData.amounts?.subtotal) {
        return invoiceData.amounts.subtotal;
    }

    // Check legacy structure
    if (invoiceData.subtotal) {
        return invoiceData.subtotal;
    }

    return null;
};

/**
 * Safely extract tax amount
 */
export const safeGetTax = (invoiceData) => {
    if (!invoiceData) return null;

    // Check new structure first
    if (invoiceData.amounts?.tax) {
        return invoiceData.amounts.tax;
    }

    // Check legacy structure
    if (invoiceData.tax) {
        return invoiceData.tax;
    }

    return null;
};

/**
 * Safely extract tax rate
 */
export const safeGetTaxRate = (invoiceData) => {
    if (!invoiceData) return null;

    // Check new structure first
    if (invoiceData.amounts?.taxRate) {
        return invoiceData.amounts.taxRate;
    }

    // Check legacy structure
    if (invoiceData.taxRate) {
        return invoiceData.taxRate;
    }

    return null;
};

/**
 * Safely extract balance due
 */
export const safeGetBalanceDue = (invoiceData) => {
    if (!invoiceData) return null;

    // Check new structure first
    if (invoiceData.amounts?.balanceDue) {
        return invoiceData.amounts.balanceDue;
    }

    // Check legacy structure
    if (invoiceData.balanceDue) {
        return invoiceData.balanceDue;
    }

    return null;
};

/**
 * Safely extract amount paid
 */
export const safeGetAmountPaid = (invoiceData) => {
    if (!invoiceData) return null;

    // Check new structure first
    if (invoiceData.amounts?.amountPaid) {
        return invoiceData.amounts.amountPaid;
    }

    // Check legacy structure
    if (invoiceData.amountPaid) {
        return invoiceData.amountPaid;
    }

    return null;
};

/**
 * Get confidence color based on percentage
 */
export const getConfidenceColor = (confidence) => {
    if (confidence >= 90) return 'success';
    if (confidence >= 70) return 'warning';
    return 'error';
};

/**
 * Get confidence text description
 */
export const getConfidenceText = (confidence) => {
    if (confidence >= 95) return 'Excellent';
    if (confidence >= 90) return 'Very Good';
    if (confidence >= 80) return 'Good';
    if (confidence >= 70) return 'Fair';
    if (confidence >= 60) return 'Poor';
    return 'Very Poor';
};

/**
 * Safely check if a field has a valid value
 */
export const hasValidValue = (value) => {
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
};

/**
 * Extract order information safely
 */
export const safeGetOrderInfo = (invoiceData) => {
    if (!invoiceData) return { orderNumber: null, orderDate: null };

    // Check new structure first
    if (invoiceData.orderInfo) {
        return {
            orderNumber: invoiceData.orderInfo.orderNumber || null,
            orderDate: invoiceData.orderInfo.orderDate || null
        };
    }

    // Check legacy structure
    return {
        orderNumber: invoiceData.orderNumber || null,
        orderDate: invoiceData.orderDate || null
    };
};

/**
 * Extract payment details safely
 */
export const safeGetPaymentDetails = (invoiceData) => {
    if (!invoiceData) return { method: null, terms: null };

    // Check new structure first
    if (invoiceData.paymentDetails) {
        return {
            method: invoiceData.paymentDetails.method || null,
            terms: invoiceData.paymentDetails.terms || null
        };
    }

    // Check legacy structure
    return {
        method: invoiceData.paymentMethod || null,
        terms: invoiceData.terms || null
    };
};

/**
 * Count extracted fields for data completeness calculation
 */
export const countExtractedFields = (invoiceData) => {
    if (!invoiceData) return 0;

    let count = 0;

    // Main fields
    if (hasValidValue(invoiceData.invoiceNumber)) count++;
    if (hasValidValue(invoiceData.date)) count++;
    if (hasValidValue(invoiceData.dueDate)) count++;

    // Vendor fields
    const vendorInfo = safeGetVendorInfo(invoiceData);
    if (hasValidValue(vendorInfo.name)) count++;
    if (hasValidValue(vendorInfo.address)) count++;
    if (hasValidValue(vendorInfo.phone)) count++;
    if (hasValidValue(vendorInfo.email)) count++;

    // Amount fields
    if (hasValidValue(safeGetTotalAmount(invoiceData))) count++;
    if (hasValidValue(safeGetSubtotal(invoiceData))) count++;
    if (hasValidValue(safeGetTax(invoiceData))) count++;
    if (hasValidValue(safeGetTaxRate(invoiceData))) count++;

    // Additional fields
    const orderInfo = safeGetOrderInfo(invoiceData);
    if (hasValidValue(orderInfo.orderNumber)) count++;

    const paymentDetails = safeGetPaymentDetails(invoiceData);
    if (hasValidValue(paymentDetails.terms)) count++;

    return count;
};

/**
 * Calculate data completeness percentage
 */
export const calculateDataCompleteness = (invoiceData) => {
    const extractedFields = countExtractedFields(invoiceData);
    const totalPossibleFields = 13; // Adjust based on your requirements

    return Math.round((extractedFields / totalPossibleFields) * 100);
};

/**
 * Format processing time in human readable format
 */
export const formatProcessingTime = (milliseconds) => {
    if (!milliseconds) return 'N/A';

    const seconds = milliseconds / 1000;

    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    } else {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    }
};

/**
 * Get file type from filename
 */
export const getFileType = (filename) => {
    if (!filename) return 'unknown';

    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'pdf':
            return 'pdf';
        case 'jpg':
        case 'jpeg':
            return 'jpeg';
        case 'png':
            return 'png';
        case 'tiff':
        case 'tif':
            return 'tiff';
        default:
            return 'unknown';
    }
};

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';

    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate invoice data structure
 */
export const validateInvoiceData = (invoiceData) => {
    const errors = [];

    if (!invoiceData) {
        errors.push('No invoice data provided');
        return { isValid: false, errors };
    }

    // Check required fields
    if (!hasValidValue(invoiceData.invoiceNumber)) {
        errors.push('Invoice number is missing');
    }

    if (!hasValidValue(invoiceData.date)) {
        errors.push('Invoice date is missing');
    }

    if (!hasValidValue(safeGetVendorName(invoiceData))) {
        errors.push('Vendor name is missing');
    }

    if (!hasValidValue(safeGetTotalAmount(invoiceData))) {
        errors.push('Total amount is missing');
    }

    return {
        isValid: errors.length === 0,
        errors,
        completeness: calculateDataCompleteness(invoiceData)
    };
};