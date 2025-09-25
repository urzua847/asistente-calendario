// src/utils/dateFormatter.js
function formatDateAsLocalISO(date) {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('Z')[0].slice(0, -4);
}

module.exports = { formatDateAsLocalISO };