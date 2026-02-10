export const formatDate = (date: Date | string | null, formatStr: string = 'yyyy-MM-dd'): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    if (formatStr === 'yyyy-MM-dd') {
        return `${year}-${month}-${day}`;
    }

    if (formatStr === 'MMM dd, yyyy') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${day}, ${year}`;
    }

    return d.toISOString();
};

export const parseISO = (dateStr: string): Date => {
    return new Date(dateStr);
};
