"""Rule titles and problem categories; same text as @payproof/api-client i18n (az.ts)."""

TITLES = {
    "R-001": "Məcburi sifariş nömrəsi (PO)",
    "R-002": "PO təsdiqlənmiş sifarişə uyğundur",
    "R-003": "Tərəflərin uyğunluğu",
    "R-004": "Valyuta və vahid uyğunluğu",
    "R-005": "Vahid qiymət uyğunluğu",
    "R-006": "Miqdar uyğunluğu",
    "R-007": "Məcburi təhvil sənədi",
    "R-008": "İmza tələbi (insan yoxlaması)",
    "R-009": "Cəmlərin arifmetik uyğunluğu",
}

# dashboard "top issue": rules that share a fix are one problem category
CATEGORIES = {
    "R-001": "PO istinadı",
    "R-002": "PO istinadı",
    "R-003": "Tərəf uyğunsuzluğu",
    "R-004": "Valyuta / vahid",
    "R-005": "Qiymət / miqdar",
    "R-006": "Qiymət / miqdar",
    "R-007": "Təhvil sənədi",
    "R-008": "Təhvil sənədi",
    "R-009": "Cəm fərqi",
}
