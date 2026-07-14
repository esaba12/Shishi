// Hebrew strings — seeded for the flagship attendee flow so RTL can be exercised end-to-end.
// Full Hebrew coverage of the rest of the app is deferred (see plan Phase 4). Falls back to English
// for any missing key (i18n.enableFallback).
import type { Strings } from "./en";

export const he: Strings = {
  common: {
    free: "חינם",
    full: "מלא",
    seatsLeft: { one: "נותר מקום אחד", other: "נותרו %{count} מקומות" },
    report: "דיווח",
  },
  discover: {
    greeting: "שבת שלום",
    title: "מצאו שולחן",
    subtitle: "ארוחות שבת חמות לידכם בתל אביב",
    all: "הכול",
    map: "מפה",
    list: "רשימה",
    emptyTitle: "עדיין לא פורסמו ארוחות",
    emptyBody: "חזרו בקרוב — או היו הראשונים לארח מלשונית הפרופיל.",
    host: "אירוח ארוחה",
    perPerson: "לאדם",
  },
  dinner: {
    title: "פרטי הארוחה",
    hostedShabbats: { one: "אירח/ה שבת אחת", other: "אירח/ה %{count} שבתות" },
    when: "מתי",
    where: "היכן",
    kosher: "רמת כשרות",
    cost: "עלות",
    seats: "מקומות",
    seatsValue: "%{left} מתוך %{total} נותרו",
    addressHidden: "%{area} · הכתובת המדויקת תישלח סמוך למועד",
    addressLocked: "הכתובת תיחשף לאחר אישורכם, סמוך למועד",
    costPerPerson: "₪%{amount} לאדם",
    confirmed: "אתם מאושרים לארוחה זו.",
    pending: "הבקשה נשלחה — ממתינים לאישור המארח.",
    declined: "המארח לא יכול היה לקבל את בקשתכם הפעם.",
    rsvp: "אישור הגעה",
    getTicket: "רכשו כרטיס",
    requestToJoin: "בקשה להצטרף",
    reportDinner: "דיווח על ארוחה זו",
  },
  checkout: {
    title: "רכשו כרטיס",
    hostShabbat: "השבת של %{host}",
    total: 'סה"כ',
    pay: "תשלום ₪%{amount}",
    chargeNotice: "לא תחויבו עד שהמקום שלכם יאושר.",
    demoNotice: "מצב הדגמה: אין עדיין מפתח Stripe, ולכן זו סימולציה של תשלום מוצלח.",
    failed: "התשלום נכשל, נסו שוב.",
  },
};
