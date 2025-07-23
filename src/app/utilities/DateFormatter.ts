


export class DateFormatter {

    // Month names lookup
    static monthNames = [
        'January', 'February', 'March', 'April',
        'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'
    ];

    /*
     * @param year  full year (e.g. 2025)
     * @param month 1–12
     * @param day   1–31
     */
    constructor(
        private year: number,
        private month: number,
        private day: number
    ) {
        this.year = year;
        this.month = month;
        this.day = day;
    }

    /** display either verbose (“Y Month D”) or numeric (“YYYY‑MM‑DD”) */
    get formattedDate(): string {

        if (this.isDateValid) {
            // verbose form
            const monthStr = DateFormatter.monthNames[this.month - 1] || '';            
            return `${this.year} ${monthStr} ${this.day}`;
        } else {
            // numeric fallback
            const numY = this.year.toString().padStart(4, '0');
            const numM = this.month.toString().padStart(2, '0');
            const numD = this.day.toString().padStart(2, '0');
            return `${numY}-${numM}-${numD}`;
        }
    }

    /**
     * Returns true if the given year/month/day form a valid calendar date.
     */
    get isDateValid(): boolean {
        // Quick checks for out‑of‑bounds month/day
        if (this.month < 1 || this.month > 12) return false;
        if (this.day < 1 || this.day > 31) return false;

        // JS Date months are 0–11
        const dt = new Date(this.year, this.month - 1, this.day);

        // If any component rolled over, it wasn’t valid
        return (
            dt.getFullYear() === this.year &&
            dt.getMonth() === this.month - 1 &&
            dt.getDate() === this.day
        );
    }

}