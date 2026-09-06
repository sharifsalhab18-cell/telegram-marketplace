# language.py
# ملف اللغات المتعددة لبوت الوساطة التجارية

LANGUAGES = {
    'uk': { # الأوكرانية (اللغة الأساسية للسوق الأوكراني)
        'welcome': "Вітаємо у нашій системі торговельного посередництва! 🤝\nБудь ласка, оберіть мову / Please choose your language / اختر لغتك:",
        'btn_buyer': "🛒 Я покупець (Шукаю товар)",
        'btn_seller': "📦 Я продавець (Пропоную товар)",
        'lang_changed': "✅ Мову змінено на українську.",
    },
    'en': { # الإنجليزية
        'welcome': "Welcome to our trade brokerage system! 🤝\nPlease choose your language / Будь ласка, оберіть мову / اختر لغتك:",
        'btn_buyer': "🛒 I am a buyer (Looking for goods)",
        'btn_seller': "📦 I am a seller (Offering goods)",
        'lang_changed': "✅ Language changed to English.",
    },
    'ar': { # العربية
        'welcome': "مرحباً بك في نظام الوساطة التجارية! 🤝\nالرجاء اختيار لغتك المفضلة / Please choose your language:",
        'btn_buyer': "🛒 أنا مشترٍ (أبحث عن بضاعة)",
        'btn_seller': "📦 أنا بائع (أعرض بضاعة)",
        'lang_changed': "✅ تم تغيير اللغة إلى العربية.",
    }
}

# دالة مساعدة لجلب النص باللغة التي اختارها المستخدم
def get_text(lang_code, key):
    if lang_code not in LANGUAGES:
        lang_code = 'en' # اللغة الافتراضية
    return LANGUAGES[lang_code].get(key, LANGUAGES['en'].get(key, ""))
