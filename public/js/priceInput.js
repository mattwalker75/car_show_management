// priceInput.js - Price input validation and formatting

/**
 * Validate price input on keyup - allows only numbers and one decimal point
 * with up to 2 decimal places
 * @param {HTMLInputElement} el - The input element
 */
function validatePriceInput(el) {
  var val = el.value.replace(/[^0-9.]/g, '');
  var parts = val.split('.');
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts.length === 2 && parts[1].length > 2) {
    val = parts[0] + '.' + parts[1].substring(0, 2);
  }
  el.value = val;
}

/**
 * Format price on blur - ensures proper decimal format
 * @param {HTMLInputElement} el - The input element
 */
function formatPriceBlur(el) {
  var num = parseFloat(el.value);
  if (!isNaN(num) && num >= 0) {
    el.value = num.toFixed(2);
  } else if (el.value !== '') {
    el.value = '';
  }
}
