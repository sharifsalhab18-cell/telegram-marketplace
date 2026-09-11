const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "";

const sessions = {};
const DB_FILE = path.join(__dirname, "marketplace-data.json");

const DEFAULT_DB = {
  users: {},
  listings: [],
  buyRequests: [],
  negotiations: [],
  deals: [],
  activities: [],
  counters: {
    listing: 1,
    request: 1,
    negotiation: 1,
    deal: 1,
    member: 1
  }
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      return {
        ...DEFAULT_DB,
        ...parsed,
        counters: {
          ...DEFAULT_DB.counters,
          ...(parsed.counters || {})
        }
      };
    }
  } catch (error) {
    console.error("Database load error:", error);
  }
  return structuredClone(DEFAULT_DB);
}

const db = loadDb();

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("Database save error:", error);
  }
}

const TEXT = {
  ar: {
    lang: "🌐 اختر لغة السوق:",
    welcome:
      "🛍️ مرحباً بك في سوق تيليجرام\n\n" +
      "سوق خاص للبيع والشراء والتفاوض وإتمام الصفقات.\n\n" +
      "🔒 خصوصية المستخدمين محفوظة.\n\n" +
      "💰 عمولة المنصة: 5%\n" +
      "2.5% على المشتري + 2.5% على البائع\n\n" +
      "للدخول إلى السوق اضغط على الزر أدناه.",
    agree: "✅ أوافق وأدخل السوق",
    menuTitle: "🛍️ أهلاً بك في سوق تيليجرام!\n\nاختر ما تريد:",
    buy: "🛒 أريد شراء",
    sell: "📦 أريد بيع",
    browse: "🛍️ عروض السوق",
    account: "👤 حسابي",
    chooseProduct: "🛒 أرسل اسم المنتج الذي تبحث عنه.\n\nمثال: iPhone 14",
    chooseMax: "💰 أرسل أقصى سعر تريد دفعه للمنتج.\n\nمثال: 25000",
    chooseRegion:
      "📍 أرسل المنطقة أو المدينة التي تريد البحث فيها.\n\nمثال: Київ\n\nأو اكتب: الكل",
    searching: "🔎 أبحث الآن في عروض سوقنا...",
    noResults: "🔎 انتهى البحث في سوقنا.\n\nلم نجد حاليًا عروضًا مطابقة لطلبك.",
    buySaved:
      "🛒 تم تسجيل طلبك في سوقنا.\n\n" +
      "إذا لم يوجد عرض مناسب الآن، يبقى الطلب مسجلًا ويمكن متابعة السوق.",
    sellProduct: "📦 أرسل اسم المنتج الذي تريد عرضه للبيع.",
    sellDescription: "📝 أرسل وصف المنتج وحالته.",
    sellPrice: "💰 أرسل السعر الذي تريد بيع المنتج به.\n\nمثال: 25000",
    sellRegion: "📍 أرسل المنطقة أو المدينة التي يوجد فيها المنتج.\n\nمثال: Київ",
    photoRequired:
      "📸 أرسل صورة واحدة على الأقل للمنتج.\nيمكنك إرسال عدة صور، ثم اضغط «تم».",
    morePhotos: "📸 أرسل صورة أخرى أو اضغط «تم» عند الانتهاء.",
    done: "✅ تم",
    listingPublished: "✅ تم نشر عرضك في سوق تيليجرام!",
    browseTitle: "🛍️ عروض السوق",
    sellOffers: "📦 عروض البيع",
    buyOffers: "🛒 عروض الشراء",
    noListings: "لا توجد عروض نشطة حاليًا.",
    contact: "💬 تفاوض على العرض",
    contactBuyer: "💬 تفاوض مع المشتري",
    negotiationPage: "💬 صفحة التفاوض",
    negotiationClosed: "❌ انتهى هذا التفاوض.",
    endNegotiation: "❌ إنهاء التفاوض",
    backToMarket: "🛍️ العودة إلى السوق",
    contacted: "✅ تم إرسال اهتمامك بالعرض إلى البائع.",
    sellerNotice: "📩 لديك مشتري مهتم بعرضك!",
    negotiationStarted: "💬 بدأ التفاوض بين المشتري والبائع.",
    negotiationText: "💬 أرسل رسالتك للتفاوض.\n\nاكتب /end لإنهاء التفاوض.",
    dealOffer: "🤝 هل توافق على إتمام الصفقة بالسعر المقترح؟",
    deal_offer: "🤝 تقديم عرض سعر",
    dealCreated: "🤝 تم تسجيل الصفقة.",
    accountText: "👤 حسابي\n\n",
    cancel: "❌ تم إلغاء العملية.",
    registrationName: "📝 للتسجيل في المنصة، أرسل اسمك.",
    registrationPhone: "📱 أرسل رقم هاتفك باستخدام زر مشاركة جهة الاتصال.",
    registered: "✅ تم التسجيل بنجاح!",
    back: "🏠 القائمة الرئيسية",
    error: "❌ حدث خطأ. حاول مرة أخرى.",
    adminFallback: "لم يتم ضبط ADMIN_CHAT_ID بعد."
  },
  uk: {
    lang: "🌐 Оберіть мову ринку:",
    welcome:
      "🛍️ Вітаємо на Telegram Marketplace\n\n" +
      "Приватний майданчик для купівлі, продажу, переговорів та завершення угод.\n\n" +
      "🔒 Конфіденційність користувачів збережена.\n\n" +
      "💰 Комісія платформи: 5%\n" +
      "2.5% покупець + 2.5% продавець\n\n" +
      "Натисніть кнопку нижче, щоб увійти.",
    agree: "✅ Погоджуюсь та входжу",
    menuTitle: "🛍️ Вітаємо на Telegram Marketplace!\n\nОберіть дію:",
    buy: "🛒 Хочу купити",
    sell: "📦 Хочу продати",
    browse: "🛍️ Пропозиції ринку",
    account: "👤 Мій профіль",
    chooseProduct: "🛒 Надішліть назву товару.\n\nНаприклад: iPhone 14",
    chooseMax: "💰 Надішліть максимальну ціну.\n\nНаприклад: 25000",
    chooseRegion: "📍 Надішліть місто або область.\n\nНаприклад: Київ\n\nАбо напишіть: будь-яка",
    searching: "🔎 Шукаю пропозиції на нашому ринку...",
    noResults: "🔎 Пошук завершено.\n\nПідходящих пропозицій зараз немає.",
    buySaved: "🛒 Ваш запит на купівлю збережено.",
    sellProduct: "📦 Надішліть назву товару.",
    sellDescription: "📝 Надішліть опис і стан товару.",
    sellPrice: "💰 Надішліть ціну продажу.\n\nНаприклад: 25000",
    sellRegion: "📍 Надішліть місто або область товару.\n\nНаприклад: Київ",
    photoRequired: "📸 Надішліть щонайменше одне фото товару.\nПісля кількох фото натисніть «Готово».",
    morePhotos: "📸 Надішліть ще фото або натисніть «Готово».",
    done: "✅ Готово",
    listingPublished: "✅ Вашу пропозицію опубліковано!",
    browseTitle: "🛍️ Пропозиції ринку",
    sellOffers: "📦 Пропозиції продажу",
    buyOffers: "🛒 Запити на купівлю",
    noListings: "Активних пропозицій зараз немає.",
    contact: "💬 Перейти до переговорів",
    contactBuyer: "💬 Переговори з покупцем",
    negotiationPage: "💬 Сторінка переговорів",
    negotiationClosed: "❌ Ці переговори завершені.",
    endNegotiation: "❌ Завершити переговори",
    backToMarket: "🛍️ Повернутися до ринку",
    contacted: "✅ Інтерес до пропозиції надіслано продавцю.",
    sellerNotice: "📩 Є покупець, зацікавлений у вашій пропозиції!",
    negotiationStarted: "💬 Переговори між покупцем і продавцем розпочато.",
    negotiationText: "💬 Надсилайте повідомлення для переговорів.\n\n/end — завершити.",
    dealOffer: "🤝 Погоджуєтесь завершити угоду за запропонованою ціною?",
    deal_offer: "🤝 Запропонувати ціну",
    dealCreated: "🤝 Угоду зареєстровано.",
    accountText: "👤 Мій профіль\n\n",
    cancel: "❌ Операцію скасовано.",
    registrationName: "📝 Для реєстрації надішліть своє ім’я.",
    registrationPhone: "📱 Надішліть номер телефону через кнопку контакту.",
    registered: "✅ Реєстрацію завершено!",
    back: "🏠 Головне меню",
    error: "❌ Сталася помилка. Спробуйте ще раз.",
    adminFallback: "ADMIN_CHAT_ID не налаштовано."
  },
  en: {
    lang: "🌐 Choose your marketplace language:",
    welcome:
      "🛍️ Welcome to Telegram Marketplace\n\n" +
      "A private marketplace for buying, selling, negotiation and completing deals.\n\n" +
      "🔒 User privacy is protected.\n\n" +
      "💰 Platform commission: 5%\n" +
      "2.5% buyer + 2.5% seller\n\n" +
      "Press the button below to enter the marketplace.",
    agree: "✅ Agree & enter",
    menuTitle: "🛍️ Welcome to Telegram Marketplace!\n\nChoose an option:",
    buy: "🛒 I want to buy",
    sell: "📦 I want to sell",
    browse: "🛍️ Marketplace offers",
    account: "👤 My account",
    chooseProduct: "🛒 Send the product name.\n\nExample: iPhone 14",
    chooseMax: "💰 Send the maximum price.\n\nExample: 25000",
    chooseRegion: "📍 Send the city or region.\n\nExample: Kyiv\n\nOr type: any",
    searching: "🔎 Searching our marketplace...",
    noResults: "🔎 Search finished.\n\nNo matching offers were found.",
    buySaved: "🛒 Your purchase request has been saved.",
    sellProduct: "📦 Send the product name.",
    sellDescription: "📝 Send the product description and condition.",
    sellPrice: "💰 Send your selling price.\n\nExample: 25000",
    sellRegion: "📍 Send the city or region where the product is located.\n\nExample: Kyiv",
    photoRequired: "📸 Send at least one product photo.\nAfter sending photos, press “Done”.",
    morePhotos: "📸 Send another photo or press “Done”.",
    done: "✅ Done",
    listingPublished: "✅ Your listing has been published!",
    browseTitle: "🛍️ Marketplace offers",
    sellOffers: "📦 Sell offers",
    buyOffers: "🛒 Buy requests",
    noListings: "There are no active offers right now.",
    contact: "💬 Open negotiation",
    contactBuyer: "💬 Negotiate with buyer",
    negotiationPage: "💬 Negotiation page",
    negotiationClosed: "❌ This negotiation is closed.",
    endNegotiation: "❌ End negotiation",
    backToMarket: "🛍️ Back to marketplace",
    contacted: "✅ Your interest was sent to the seller.",
    sellerNotice: "📩 A buyer is interested in your listing!",
    negotiationStarted: "💬 Negotiation between buyer and seller has started.",
    negotiationText: "💬 Send your negotiation messages.\n\nUse /end to finish.",
    dealOffer: "🤝 Do you agree to complete the deal at the proposed price?",
    deal_offer: "🤝 Make a price offer",
    dealCreated: "🤝 Deal registered.",
    accountText: "👤 My account\n\n",
    cancel: "❌ Operation cancelled.",
    registrationName: "📝 Send your name to register.",
    registrationPhone: "📱 Send your phone number using the contact button.",
    registered: "✅ Registration completed!",
    back: "🏠 Main menu",
    error: "❌ Something went wrong. Try again.",
    adminFallback: "ADMIN_CHAT_ID is not configured."
  }
};

function t(chatId, key) {
  const lang = db.users[chatId]?.language || "ar";
  return TEXT[lang]?.[key] || TEXT.ar[key] || key;
}

function getUser(chatId) {
  return db.users[String(chatId)] || null;
}

function generateMemberId() {
  const number = db.counters.member++;
  return `TM-${String(number).padStart(6, "0")}`;
}

function setUser(chatId, data = {}) {
  if (!db.users[chatId]) {
    db.users[chatId] = {
      chatId: String(chatId),
      language: null,
      memberId: null,
      agreedAt: null,
      name: null,
      phone: null,
      registeredAt: null,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
  }

  Object.assign(db.users[chatId], data, {
    lastSeenAt: new Date().toISOString()
  });

  saveDb();
  return db.users[chatId];
}

function ensureMemberId(chatId) {
  const user = setUser(chatId);

  if (!user.memberId) {
    user.memberId = generateMemberId();
    saveDb();
  }

  return user.memberId;
}

function logActivity(chatId, type, extra = {}) {
  db.activities.push({
    id: db.activities.length + 1,
    chatId: String(chatId),
    type,
    ...extra,
    createdAt: new Date().toISOString()
  });

  if (db.activities.length > 10000) {
    db.activities.shift();
  }

  saveDb();
}

async function sendTelegram(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_TOKEN) return;

  const body = {
    chat_id: chatId,
    text
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    console.error(
      "Telegram sendMessage error:",
      await response.text()
    );
  }
}

async function sendPhoto(chatId, photoId, caption = "", replyMarkup = null) {
  if (!TELEGRAM_TOKEN) return;

  const body = {
    chat_id: chatId,
    photo: photoId
  };

  if (caption) {
    body.caption = caption;
  }

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    console.error(
      "Telegram sendPhoto error:",
      await response.text()
    );
  }
}

async function answerCallback(callbackId) {
  if (!TELEGRAM_TOKEN) return;

  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        callback_query_id: callbackId
      })
    }
  );
}

async function notifyAdmin(text) {
  if (!ADMIN_CHAT_ID) return;
  await sendTelegram(ADMIN_CHAT_ID, text);
}

function parsePrice(text) {
  const n = Number(
    String(text || "")
      .replace(/\s/g, "")
      .replace(/₴/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatPrice(price) {
  if (price === null || price === undefined) {
    return "—";
  }

  return `${Math.round(price).toLocaleString("uk-UA")} ₴`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase();
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🇺🇦 Українська",
          callback_data: "lang_uk"
        },
        {
          text: "🇸🇦 العربية",
          callback_data: "lang_ar"
        }
      ],
      [
        {
          text: "🇬🇧 English",
          callback_data: "lang_en"
        }
      ]
    ]
  };
}

async function askLanguage(chatId) {
  await sendTelegram(
    chatId,
    TEXT.ar.lang,
    languageKeyboard()
  );
}

async function showWelcome(chatId) {
  await sendTelegram(
    chatId,
    t(chatId, "welcome"),
    {
      inline_keyboard: [
        [
          {
            text: t(chatId, "agree"),
            callback_data: "agree"
          }
        ]
      ]
    }
  );
}

async function showMainMenu(chatId) {
  const buttons = [
    [
      {
        text: t(chatId, "buy"),
        callback_data: "buy"
      }
    ],
    [
      {
        text: t(chatId, "sell"),
        callback_data: "sell"
      }
    ],
    [
      {
        text: t(chatId, "browse"),
        callback_data: "browse"
      }
    ],
    [
      {
        text: t(chatId, "account"),
        callback_data: "account"
      }
    ]
  ];

  await sendTelegram(
    chatId,
    t(chatId, "menuTitle"),
    {
      inline_keyboard: buttons
    }
  );
}

function accountKeyboard(chatId) {
  return {
    inline_keyboard: [
      [
        {
          text: t(chatId, "back"),
          callback_data: "menu"
        }
      ]
    ]
  };
}

function searchListings(product, maxPrice, region) {
  const wantedProduct = normalizeText(product);
  const wantedRegion = normalizeText(region);

  return db.listings
    .filter((listing) => {
      if (listing.status !== "active") {
        return false;
      }

      if (listing.price > maxPrice) {
        return false;
      }

      const lp = normalizeText(listing.product);
      const lr = normalizeText(listing.region);

      const productMatch =
        lp.includes(wantedProduct) ||
        wantedProduct.includes(lp);

      if (!productMatch) {
        return false;
      }

      if (
        wantedRegion &&
        !["الكل", "будь-яка", "any"].includes(wantedRegion) &&
        !lr.includes(wantedRegion) &&
        !wantedRegion.includes(lr)
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);
}
  if (data === "done_photos") {
    const session = sessions[chatId];

    if (!session || session.step !== "sell_photos") {
      await sendTelegram(chatId, t(chatId, "error"));
      return;
    }

    if (!session.photos || session.photos.length === 0) {
      await sendTelegram(chatId, t(chatId, "photoRequired"));
      return;
    }

    const listing = createListing(chatId, session);
    logActivity(chatId, "listing_created", {
      listingId: listing.id
    });

    await sendTelegram(
      chatId,
      `${t(chatId, "listingPublished")}\n\n` +
      `📌 #${listing.id}\n` +
      `🛒 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}`,
      {
        inline_keyboard: [
          [
            {
              text: t(chatId, "browse"),
              callback_data: "browse"
            }
          ],
          [
            {
              text: t(chatId, "back"),
              callback_data: "menu"
            }
          ]
        ]
      }
    );

    await notifyAdmin(
      `📦 عرض بيع جديد #${listing.id}\n\n` +
      `🛒 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}\n` +
      `👤 المستخدم: ${chatId}`
    );

    sessions[chatId] = { step: "menu" };
    return;
  }

  if (data.startsWith("contact_sell_")) {
    const listingId = Number(data.slice("contact_sell_".length));
    await contactSellOffer(chatId, listingId);
    return;
  }

  if (data.startsWith("contact_buy_")) {
    const requestId = Number(data.slice("contact_buy_".length));
    await contactBuyOffer(chatId, requestId);
    return;
  }

  if (data.startsWith("neg_open_")) {
    const negotiationId = Number(data.slice("neg_open_".length));
    await showNegotiationPage(chatId, negotiationId);
    return;
  }

  if (data.startsWith("neg_end_")) {
    const negotiationId = Number(data.slice("neg_end_".length));

    const negotiation = db.negotiations.find(
      n =>
        n.id === negotiationId &&
        n.status === "active" &&
        (
          String(n.buyerChatId) === String(chatId) ||
          String(n.sellerChatId) === String(chatId)
        )
    );

    if (!negotiation) {
      await sendTelegram(
        chatId,
        t(chatId, "negotiationClosed"),
        accountKeyboard(chatId)
      );
      return;
    }

    negotiation.status = "closed";
    negotiation.updatedAt = new Date().toISOString();
    saveDb();

    const other =
      String(negotiation.buyerChatId) === String(chatId)
        ? negotiation.sellerChatId
        : negotiation.buyerChatId;

    await sendTelegram(
      chatId,
      t(chatId, "negotiationClosed"),
      accountKeyboard(chatId)
    );

    await sendTelegram(
      other,
      t(other, "negotiationClosed"),
      accountKeyboard(other)
    );

    logActivity(chatId, "negotiation_closed", {
      negotiationId
    });

    return;
  }

  if (data.startsWith("deal_offer_")) {
    const negotiationId = Number(data.slice("deal_offer_".length));

    const negotiation = db.negotiations.find(
      n =>
        n.id === negotiationId &&
        n.status === "active" &&
        (
          String(n.buyerChatId) === String(chatId) ||
          String(n.sellerChatId) === String(chatId)
        )
    );

    if (!negotiation) {
      await sendTelegram(chatId, t(chatId, "negotiationClosed"));
      return;
    }

    sessions[chatId] = {
      step: "offer_price",
      negotiationId
    };

    await sendTelegram(
      chatId,
      `💰 ${t(chatId, "deal_offer")}\n\n` +
      `أرسل السعر المقترح بالهريفنيا.\n\n` +
      `مثال: 20000`
    );

    return;
  }

  if (data.startsWith("deal_approve_")) {
    const negotiationId = Number(data.slice("deal_approve_".length));

    const negotiation = db.negotiations.find(
      n =>
        n.id === negotiationId &&
        n.status === "active"
    );

    if (!negotiation) {
      await sendTelegram(chatId, t(chatId, "negotiationClosed"));
      return;
    }

    if (String(negotiation.sellerChatId) !== String(chatId)) {
      await sendTelegram(
        chatId,
        "❌ قبول الصفقة متاح للبائع فقط."
      );
      return;
    }

    if (!negotiation.proposedPrice) {
      await sendTelegram(
        chatId,
        "❌ لا يوجد سعر مقترح حاليًا."
      );
      return;
    }

    await createDeal(
      negotiation,
      negotiation.proposedPrice
    );

    sessions[chatId] = { step: "menu" };
    return;
  }
}

async function handleMessage(message) {
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text =
    typeof message.text === "string"
      ? message.text.trim()
      : "";

  let user = getUser(chatId);

  if (!user) {
    user = setUser(chatId);
  }

  if (message.photo?.length) {
    const session = sessions[chatId];

    if (session?.step === "sell_photos") {
      const photo = message.photo[message.photo.length - 1];

      session.photos = session.photos || [];
      session.photos.push(photo.file_id);

      await sendTelegram(
        chatId,
        t(chatId, "morePhotos"),
        {
          inline_keyboard: [
            [
              {
                text: t(chatId, "done"),
                callback_data: "done_photos"
              }
            ]
          ]
        }
      );

      return;
    }
  }

  if (text === "/start") {
    sessions[chatId] = { step: "language" };

    if (!user.language) {
      await askLanguage(chatId);
      return;
    }

    if (!user.agreedAt) {
      await showWelcome(chatId);
      return;
    }

    if (!user.registeredAt) {
      sessions[chatId] = {
        step: "registration_name"
      };
      await sendTelegram(
        chatId,
        t(chatId, "registrationName")
      );
      return;
    }

    if (!user.memberId) {
      ensureMemberId(chatId);
    }

    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }

  if (!user.language) {
    await askLanguage(chatId);
    return;
  }

  if (text === "/cancel") {
    sessions[chatId] = { step: "menu" };
    await sendTelegram(
      chatId,
      t(chatId, "cancel")
    );
    await showMainMenu(chatId);
    return;
  }

  if (text === "/menu") {
    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }

  if (text === "/account") {
    const mine = db.listings.filter(
      x => String(x.sellerChatId) === String(chatId)
    );

    const buys = db.buyRequests.filter(
      x => String(x.buyerChatId) === String(chatId)
    );

    const deals = db.deals.filter(
      x =>
        String(x.buyerChatId) === String(chatId) ||
        String(x.sellerChatId) === String(chatId)
    );

    await sendTelegram(
      chatId,
      t(chatId, "accountText") +
      `🆔 رقم العضوية: ${user.memberId || "—"}\n` +
      `📦 عروض البيع: ${mine.length}\n` +
      `🛒 طلبات الشراء: ${buys.length}\n` +
      `🤝 الصفقات: ${deals.length}`,
      accountKeyboard(chatId)
    );

    return;
  }

  if (text === "/negotiations") {
    const negotiations = db.negotiations.filter(
      n =>
        n.status === "active" &&
        (
          String(n.buyerChatId) === String(chatId) ||
          String(n.sellerChatId) === String(chatId)
        )
    );

    if (!negotiations.length) {
      await sendTelegram(
        chatId,
        "💬 لا توجد مفاوضات نشطة حاليًا.",
        accountKeyboard(chatId)
      );
      return;
    }

    for (const negotiation of negotiations) {
      await sendTelegram(
        chatId,
        `💬 تفاوض #${negotiation.id}`,
        {
          inline_keyboard: [
            [
              {
                text: t(chatId, "negotiationPage"),
                callback_data: `neg_open_${negotiation.id}`
              }
            ]
          ]
        }
      );
    }

    return;
  }

  if (text === "/end") {
    const session = sessions[chatId];

    if (session?.step === "negotiation") {
      const negotiation = db.negotiations.find(
        n =>
          n.id === session.negotiationId &&
          n.status === "active" &&
          (
            String(n.buyerChatId) === String(chatId) ||
            String(n.sellerChatId) === String(chatId)
          )
      );

      if (!negotiation) {
        await sendTelegram(
          chatId,
          t(chatId, "negotiationClosed")
        );
        return;
      }

      negotiation.status = "closed";
      negotiation.updatedAt = new Date().toISOString();
      saveDb();

      const other =
        String(negotiation.buyerChatId) === String(chatId)
          ? negotiation.sellerChatId
          : negotiation.buyerChatId;

      await sendTelegram(
        chatId,
        t(chatId, "negotiationClosed"),
        accountKeyboard(chatId)
      );

      await sendTelegram(
        other,
        t(other, "negotiationClosed"),
        accountKeyboard(other)
      );

      logActivity(chatId, "negotiation_closed", {
        negotiationId: negotiation.id
      });

      sessions[chatId] = { step: "menu" };
      return;
    }

    await sendTelegram(
      chatId,
      t(chatId, "cancel")
    );

    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }

  const session = sessions[chatId];

  if (
    session?.step === "registration_name"
  ) {
    if (!text) {
      await sendTelegram(
        chatId,
        t(chatId, "registrationName")
      );
      return;
    }

    session.name = text;
    session.step = "registration_phone";

    await sendTelegram(
      chatId,
      t(chatId, "registrationPhone"),
      {
        keyboard: [
          [
            {
              text: "📱 مشاركة رقم الهاتف",
              request_contact: true
            }
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    );

    return;
  }

  if (
    session?.step === "registration_phone"
  ) {
    let phone = null;

    if (message.contact?.phone_number) {
      phone = message.contact.phone_number;
    } else if (text) {
      phone = text;
    }

    if (!phone) {
      await sendTelegram(
        chatId,
        t(chatId, "registrationPhone")
      );
      return;
    }

    const memberId = ensureMemberId(chatId);

    setUser(chatId, {
      name: session.name,
      phone,
      memberId,
      registeredAt: new Date().toISOString()
    });

    logActivity(chatId, "registration_completed", {
      memberId
    });

    sessions[chatId] = { step: "menu" };

    await sendTelegram(
      chatId,
      `${t(chatId, "registered")}\n\n` +
      `👤 ${session.name}\n` +
      `🆔 ${memberId}`,
      {
        remove_keyboard: true
      }
    );

    await showMainMenu(chatId);
    return;
  }

  if (session?.step === "buy_product") {
    if (!text) return;

    session.product = text;
    session.step = "buy_max_price";

    await sendTelegram(
      chatId,
      t(chatId, "chooseMax")
    );

    return;
  }

  if (session?.step === "buy_max_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        t(chatId, "chooseMax")
      );
      return;
    }

    session.maxPrice = price;
    session.step = "buy_region";

    await sendTelegram(
      chatId,
      t(chatId, "chooseRegion")
    );

    return;
  }

  if (session?.step === "buy_region") {
    if (!text) return;

    session.region = text;

    await sendTelegram(
      chatId,
      t(chatId, "searching")
    );

    const results = searchListings(
      session.product,
      session.maxPrice,
      session.region
    );

    await sendMarketplaceResults(
      chatId,
      session,
      results
    );

    sessions[chatId] = { step: "menu" };
    return;
  }

  if (session?.step === "sell_product") {
    if (!text) return;

    session.product = text;
    session.step = "sell_description";

    await sendTelegram(
      chatId,
      t(chatId, "sellDescription")
    );

    return;
  }

  if (session?.step === "sell_description") {
    if (!text) return;

    session.description = text;
    session.step = "sell_price";

    await sendTelegram(
      chatId,
      t(chatId, "sellPrice")
    );

    return;
  }

  if (session?.step === "sell_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        t(chatId, "sellPrice")
      );
      return;
    }

    session.price = price;
    session.step = "sell_region";

    await sendTelegram(
      chatId,
      t(chatId, "sellRegion")
    );

    return;
  }

  if (session?.step === "sell_region") {
    if (!text) return;

    session.region = text;
    session.photos = [];
    session.step = "sell_photos";

    await sendTelegram(
      chatId,
      t(chatId, "photoRequired"),
      {
        inline_keyboard: [
          [
            {
              text: t(chatId, "done"),
              callback_data: "done_photos"
            }
          ]
        ]
      }
    );

    return;
  }

  if (session?.step === "negotiation") {
    if (!text) return;

    await forwardNegotiationMessage(
      chatId,
      text
    );

    return;
  }

  if (session?.step === "offer_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        "❌ أرسل سعرًا صحيحًا، مثل: 20000"
      );
      return;
    }

    const negotiation = db.negotiations.find(
      n =>
        n.id === session.negotiationId &&
        n.status === "active" &&
        (
          String(n.buyerChatId) === String(chatId) ||
          String(n.sellerChatId) === String(chatId)
        )
    );

    if (!negotiation) {
      await sendTelegram(
        chatId,
        t(chatId, "negotiationClosed")
      );
      sessions[chatId] = { step: "menu" };
      return;
    }

    negotiation.proposedPrice = price;
    negotiation.updatedAt = new Date().toISOString();
    saveDb();

    const other =
      String(negotiation.buyerChatId) === String(chatId)
        ? negotiation.sellerChatId
        : negotiation.buyerChatId;

    await sendTelegram(
      other,
      `💰 تم تقديم عرض سعر: ${formatPrice(price)}\n\n` +
      `🤝 ${t(other, "dealOffer")}`,
      {
        inline_keyboard: [
          [
            {
              text: "✅ قبول الصفقة",
              callback_data: `deal_approve_${negotiation.id}`
            }
          ],
          [
            {
              text: t(other, "negotiationPage"),
              callback_data: `neg_open_${negotiation.id}`
            }
          ]
        ]
      }
    );

    await sendTelegram(
      chatId,
      `✅ تم إرسال عرض السعر: ${formatPrice(price)}`
    );

    logActivity(chatId, "price_offer", {
      negotiationId: negotiation.id,
      price
    });

    sessions[chatId] = {
      step: "negotiation",
      negotiationId: negotiation.id
    };

    return;
  }

  if (session?.step === "menu") {
    await showMainMenu(chatId);
    return;
  }

  await showMainMenu(chatId);
}

const server = http.createServer(
  async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        res.end("Telegram Marketplace is running.");
        return;
      }

      if (
        req.method === "POST" &&
        req.url === "/webhook"
      ) {
        let body = "";

        req.on("data", chunk => {
          body += chunk;
        });

        req.on("end", async () => {
          try {
            const update = JSON.parse(body);

            if (update.callback_query) {
              await handleCallback(
                update.callback_query
              );
            } else if (update.message) {
              await handleMessage(
                update.message
              );
            }

            res.writeHead(200, {
              "Content-Type": "application/json"
            });

            res.end(
              JSON.stringify({
                ok: true
              })
            );
          } catch (error) {
            console.error(
              "Webhook processing error:",
              error
            );

            res.writeHead(200, {
              "Content-Type": "application/json"
            });

            res.end(
              JSON.stringify({
                ok: false
              })
            );
          }
        });

        return;
      }

      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Not found.");
    } catch (error) {
      console.error(
        "HTTP server error:",
        error
      );

      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Server error.");
    }
  }
);

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Telegram Marketplace running on port ${PORT}`
    );
  }
);
  if (data === "done_photos") {
    const session = sessions[chatId];
    if (!session?.photos?.length) {
      await sendTelegram(chatId, t(chatId, "photoRequired"));
      return;
    }
    session.step = "sell_region";
    await sendTelegram(chatId, t(chatId, "sellRegion"));
    return;
  }

  if (data.startsWith("contact_sell_")) {
    const listingId = Number(data.slice(13));
    if (Number.isInteger(listingId)) await contactSellOffer(chatId, listingId);
    return;
  }

  if (data.startsWith("contact_buy_")) {
    const requestId = Number(data.slice(12));
    if (Number.isInteger(requestId)) await contactBuyOffer(chatId, requestId);
    return;
  }

  if (data.startsWith("neg_open_")) {
    const negotiationId = Number(data.slice(9));
    if (Number.isInteger(negotiationId)) await showNegotiationPage(chatId, negotiationId);
    return;
  }

  if (data.startsWith("neg_end_")) {
    const negotiationId = Number(data.slice(8));
    const negotiation = db.negotiations.find(n => n.id === negotiationId);

    if (
      !negotiation ||
      (
        String(negotiation.buyerChatId) !== String(chatId) &&
        String(negotiation.sellerChatId) !== String(chatId)
      )
    ) {
      return;
    }

    negotiation.status = "closed";
    negotiation.updatedAt = new Date().toISOString();
    saveDb();

    const other =
      String(negotiation.buyerChatId) === String(chatId)
        ? negotiation.sellerChatId
        : negotiation.buyerChatId;

    sessions[chatId] = { step: "menu" };
    sessions[other] = { step: "menu" };

    await sendTelegram(chatId, t(chatId, "negotiationClosed"));

    await sendTelegram(
      other,
      t(other, "negotiationClosed"),
      {
        inline_keyboard: [
          [{ text: t(other, "browse"), callback_data: "browse" }]
        ]
      }
    );

    await showMainMenu(chatId);
    return;
  }

  if (data.startsWith("deal_approve_")) {
    const negotiationId = Number(data.slice(13));

    const negotiation = db.negotiations.find(
      n => n.id === negotiationId && n.status === "active"
    );

    if (!negotiation) {
      await sendTelegram(chatId, "❌ التفاوض غير متاح.");
      return;
    }

    if (String(negotiation.sellerChatId) !== String(chatId)) {
      await sendTelegram(chatId, "❌ قبول الصفقة متاح للبائع فقط.");
      return;
    }

    const price = negotiation.proposedPrice;

    if (!price) {
      await sendTelegram(chatId, "❌ لا يوجد عرض سعر بانتظار القبول.");
      return;
    }

    await createDeal(negotiation, price);
    return;
  }

  if (data.startsWith("deal_offer_")) {
    const negotiationId = Number(data.slice(11));

    const negotiation = db.negotiations.find(
      n => n.id === negotiationId && n.status === "active"
    );

    if (!negotiation) return;

    if (
      String(negotiation.buyerChatId) !== String(chatId) &&
      String(negotiation.sellerChatId) !== String(chatId)
    ) {
      return;
    }

    sessions[chatId] = {
      step: "offer_price",
      negotiationId
    };

    await sendTelegram(
      chatId,
      "💰 أرسل السعر الذي تقترحه لإتمام الصفقة."
    );

    return;
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  setUser(chatId, {
    username: message.from?.username || null,
    firstName: message.from?.first_name || null
  });

  if (message.photo?.length) {
    const session = sessions[chatId];

    if (session?.step === "sell_photos") {
      session.photos.push(
        message.photo[message.photo.length - 1].file_id
      );

      logActivity(chatId, "upload_listing_photo");

      await sendTelegram(
        chatId,
        t(chatId, "morePhotos"),
        {
          inline_keyboard: [[
            {
              text: t(chatId, "done"),
              callback_data: "done_photos"
            }
          ]]
        }
      );

      return;
    }
  }

  if (text === "/start") {
    sessions[chatId] = { step: "language" };
    setUser(chatId);
    logActivity(chatId, "start");

    await askLanguage(chatId);
    return;
  }

  if (!db.users[chatId]?.language) {
    await askLanguage(chatId);
    return;
  }

  const sessionBeforeCommands = sessions[chatId];

  if (sessionBeforeCommands?.step === "registration_name") {
    if (!text) return;

    setUser(chatId, { name: text });

    sessions[chatId] = {
      step: "registration_phone"
    };

    await sendTelegram(
      chatId,
      t(chatId, "registrationPhone"),
      {
        keyboard: [[
          {
            text: "📱 مشاركة رقم الهاتف",
            request_contact: true
          }
        ]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    );

    return;
  }

  if (sessionBeforeCommands?.step === "registration_phone") {
    const contact = message.contact;

    if (!contact?.phone_number) {
      await sendTelegram(
        chatId,
        t(chatId, "registrationPhone")
      );
      return;
    }

    if (
      contact.user_id &&
      String(contact.user_id) !== String(chatId)
    ) {
      await sendTelegram(
        chatId,
        "❌ يجب مشاركة رقم هاتف حسابك أنت."
      );
      return;
    }

    setUser(chatId, {
      phone: contact.phone_number,
      registeredAt: new Date().toISOString()
    });

    ensureMemberId(chatId);

    logActivity(chatId, "registered");

    sessions[chatId] = {
      step: "menu"
    };

    await sendTelegram(
      chatId,
      t(chatId, "registered") +
      `\n\n🆔 رقم العضوية: ${getUser(chatId).memberId}`,
      {
        remove_keyboard: true
      }
    );

    await showMainMenu(chatId);
    return;
  }

  if (text === "/cancel") {
    sessions[chatId] = { step: "menu" };

    await sendTelegram(
      chatId,
      t(chatId, "cancel")
    );

    await showMainMenu(chatId);
    return;
  }

  if (text === "/menu") {
    sessions[chatId] = { step: "menu" };

    await showMainMenu(chatId);
    return;
  }

  if (text === "/negotiations") {
    const active = db.negotiations.filter(
      n =>
        n.status === "active" &&
        (
          String(n.buyerChatId) === String(chatId) ||
          String(n.sellerChatId) === String(chatId)
        )
    );

    if (!active.length) {
      await sendTelegram(
        chatId,
        "💬 لا توجد مفاوضات نشطة.",
        {
          inline_keyboard: [[
            {
              text: t(chatId, "browse"),
              callback_data: "browse"
            }
          ]]
        }
      );

      return;
    }

    await sendTelegram(
      chatId,
      t(chatId, "negotiationPage")
    );

    for (const n of active) {
      await sendTelegram(
        chatId,
        `💬 تفاوض #${n.id}`,
        {
          inline_keyboard: [[
            {
              text: t(chatId, "negotiationPage"),
              callback_data: `neg_open_${n.id}`
            }
          ]]
        }
      );
    }

    return;
  }

  if (text === "/account") {
    await handleCallback({
      id: "internal",
      message: {
        chat: {
          id: chatId
        }
      },
      data: "account"
    });

    return;
  }

  if (text === "/end") {
    const session = sessions[chatId];

    if (session?.step === "negotiation") {
      const negotiation = db.negotiations.find(
        n =>
          n.id === session.negotiationId &&
          n.status === "active"
      );

      if (
        negotiation &&
        (
          String(negotiation.buyerChatId) === String(chatId) ||
          String(negotiation.sellerChatId) === String(chatId)
        )
      ) {
        negotiation.status = "closed";
        negotiation.updatedAt = new Date().toISOString();

        saveDb();

        const other =
          String(negotiation.buyerChatId) === String(chatId)
            ? negotiation.sellerChatId
            : negotiation.buyerChatId;

        sessions[chatId] = { step: "menu" };
        sessions[other] = { step: "menu" };

        await sendTelegram(
          chatId,
          t(chatId, "negotiationClosed")
        );

        await sendTelegram(
          other,
          t(other, "negotiationClosed"),
          {
            inline_keyboard: [[
              {
                text: t(other, "browse"),
                callback_data: "browse"
              }
            ]]
          }
        );

        await showMainMenu(chatId);
        return;
      }
    }
  }

  const session = sessions[chatId];

  if (session?.step === "buy_product") {
    if (!text) return;

    session.product = text;
    session.step = "buy_max_price";

    await sendTelegram(
      chatId,
      t(chatId, "chooseMax")
    );

    return;
  }

  if (session?.step === "buy_max_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        t(chatId, "chooseMax")
      );
      return;
    }

    session.maxPrice = price;
    session.step = "buy_region";

    await sendTelegram(
      chatId,
      t(chatId, "chooseRegion")
    );

    return;
  }

  if (session?.step === "buy_region") {
    if (!text) return;

    session.region = text;
    session.step = "buy_results";

    logActivity(
      chatId,
      "buy_search",
      {
        product: session.product,
        maxPrice: session.maxPrice,
        region: session.region
      }
    );

    await sendTelegram(
      chatId,
      t(chatId, "searching") +
      `\n\n🛒 ${session.product}` +
      `\n💰 ${formatPrice(session.maxPrice)}` +
      `\n📍 ${session.region}`
    );

    const results = searchListings(
      session.product,
      session.maxPrice,
      session.region
    );

    await sendMarketplaceResults(
      chatId,
      session,
      results
    );

    return;
  }

  if (session?.step === "sell_product") {
    if (!text) return;

    session.product = text;
    session.step = "sell_description";

    await sendTelegram(
      chatId,
      t(chatId, "sellDescription")
    );

    return;
  }

  if (session?.step === "sell_description") {
    if (!text) return;

    session.description = text;
    session.step = "sell_price";

    await sendTelegram(
      chatId,
      t(chatId, "sellPrice")
    );

    return;
  }

  if (session?.step === "sell_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        t(chatId, "sellPrice")
      );
      return;
    }

    session.price = price;
    session.step = "sell_region";

    await sendTelegram(
      chatId,
      t(chatId, "sellRegion")
    );

    return;
  }

  if (session?.step === "sell_region") {
    if (!text) return;

    session.region = text;
    session.step = "sell_photos";

    await sendTelegram(
      chatId,
      t(chatId, "photoRequired"),
      {
        inline_keyboard: [[
          {
            text: t(chatId, "done"),
            callback_data: "done_photos"
          }
        ]]
      }
    );

    return;
  }

  if (session?.step === "negotiation") {
    if (
      text &&
      await forwardNegotiationMessage(chatId, text)
    ) {
      return;
    }
  }

  if (session?.step === "offer_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        "❌ السعر غير صحيح. أرسل رقمًا."
      );
      return;
    }

    session.proposedPrice = price;

    const negotiation = db.negotiations.find(
      n =>
        n.id === session.negotiationId &&
        n.status === "active"
    );

    if (!negotiation) {
      await sendTelegram(
        chatId,
        "❌ التفاوض غير متاح."
      );
      return;
    }

    if (
      String(negotiation.buyerChatId) !== String(chatId) &&
      String(negotiation.sellerChatId) !== String(chatId)
    ) {
      await sendTelegram(
        chatId,
        "❌ أنت لست طرفًا في هذا التفاوض."
      );
      return;
    }

    negotiation.proposedPrice = price;
    negotiation.updatedAt = new Date().toISOString();

    saveDb();

    const other =
      String(negotiation.buyerChatId) === String(chatId)
        ? negotiation.sellerChatId
        : negotiation.buyerChatId;

    sessions[other] = {
      step: "negotiation",
      negotiationId: negotiation.id
    };

    await sendTelegram(
      other,
      `💰 الطرف الآخر اقترح ${formatPrice(price)} لإتمام الصفقة.\n\n` +
      t(other, "dealOffer"),
      {
        inline_keyboard: [
          [
            {
              text: "🤝 موافق",
              callback_data: `deal_approve_${negotiation.id}`
            }
          ],
          [
            {
              text: "💬 تفاوض",
              callback_data: `neg_open_${negotiation.id}`
            }
          ]
        ]
      }
    );

    await sendTelegram(
      chatId,
      `📨 تم إرسال عرض السعر ${formatPrice(price)} للطرف الآخر.`
    );

    return;
  }

  await sendTelegram(
    chatId,
    "ℹ️ استخدم /start للبدء من جديد."
  );
}

async function handleWebhook(body) {
  if (body.callback_query) {
    await handleCallback(body.callback_query);
    return;
  }

  if (body.message) {
    await handleMessage(body.message);
  }
}

const server = http.createServer(
  (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(
        200,
        {
          "Content-Type": "text/html; charset=utf-8"
        }
      );

      res.end(`
        <!doctype html>
        <html lang="uk" dir="ltr">
        <head>
          <meta charset="utf-8">
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1"
          >
        </head>
        <body>
          <h1>🛍️ Telegram Marketplace</h1>
          <p>Marketplace працює.</p>
        </body>
        </html>
      `);

      return;
    }

    if (req.method === "POST" && req.url === "/webhook") {
      let data = "";

      req.on("data", chunk => {
        data += chunk;
      });

      req.on("end", () => {
        try {
          const body = JSON.parse(data);

          res.writeHead(
            200,
            {
              "Content-Type": "text/plain"
            }
          );

          res.end("OK");

          handleWebhook(body).catch(error => {
            console.error(
              "Webhook processing error:",
              error
            );
          });
        } catch (error) {
          console.error(
            "Webhook JSON error:",
            error
          );

          res.writeHead(
            400,
            {
              "Content-Type": "text/plain"
            }
          );

          res.end("Bad Request");
        }
      });

      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  }
);

if (!TELEGRAM_TOKEN) {
  console.error(
    "TELEGRAM_BOT_TOKEN is not configured"
  );
}

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Telegram Marketplace server running on port ${PORT}`
    );
  }
);