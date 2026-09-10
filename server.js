const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "";

const DB_FILE = path.join(__dirname, "marketplace-data.json");

const sessions = {};

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
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

      return {
        ...DEFAULT_DB,
        ...data,
        users: data.users || {},
        listings: data.listings || [],
        buyRequests: data.buyRequests || [],
        negotiations: data.negotiations || [],
        deals: data.deals || [],
        activities: data.activities || [],
        counters: {
          ...DEFAULT_DB.counters,
          ...(data.counters || {})
        }
      };
    }
  } catch (error) {
    console.error("Database load error:", error);
  }

  return JSON.parse(JSON.stringify(DEFAULT_DB));
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
    browse: "👀 للتصفح فقط",
    account: "👤 حسابي",

    chooseProduct:
      "🛒 أرسل اسم المنتج الذي تبحث عنه.\n\nمثال: iPhone 14",

    chooseMax:
      "💰 أرسل أقصى سعر تريد دفعه للمنتج.\n\nمثال: 25000",

    chooseRegion:
      "📍 أرسل المنطقة أو المدينة التي تريد البحث فيها.\n\n" +
      "مثال: Київ\n\nأو اكتب: الكل",

    searching: "🔎 أبحث الآن في عروض سوقنا...",

    noResults:
      "🔎 انتهى البحث في سوقنا.\n\n" +
      "لم نجد حاليًا عروضًا مطابقة لطلبك.",

    buySaved:
      "🛒 تم تسجيل طلبك في سوقنا.\n\n" +
      "إذا لم يوجد عرض مناسب الآن، يبقى الطلب مسجلًا ويمكن متابعة السوق.",

    sellProduct:
      "📦 أرسل اسم المنتج الذي تريد عرضه للبيع.",

    sellDescription:
      "📝 أرسل وصف المنتج وحالته.",

    sellPrice:
      "💰 أرسل السعر الذي تريد بيع المنتج به.\n\nمثال: 25000",

    sellRegion:
      "📍 أرسل المنطقة أو المدينة التي يوجد فيها المنتج.\n\nمثال: Київ",

    photoRequired:
      "📸 أرسل صورة واحدة على الأقل للمنتج.\n" +
      "يمكنك إرسال عدة صور، ثم اضغط «تم».",

    morePhotos:
      "📸 أرسل صورة أخرى أو اضغط «تم» عند الانتهاء.",

    done: "✅ تم",

    listingPublished:
      "✅ تم نشر عرضك في سوق تيليجرام!",

    browseTitle:
      "👀 عروض سوق تيليجرام",

    noListings:
      "لا توجد عروض نشطة حاليًا.",

    contact:
      "💬 تواصل مع البائع",

    sellerNotice:
      "📩 لديك مشتري مهتم بعرضك!",

    negotiationStarted:
      "💬 بدأ التفاوض بين المشتري والبائع.",

    negotiationText:
      "💬 أرسل رسالتك للتفاوض.\n\nاكتب /end لإنهاء التفاوض.",

    dealOffer:
      "🤝 هل توافق على إتمام الصفقة بالسعر المقترح؟",

    dealCreated:
      "🤝 تم تسجيل الصفقة.",

    accountText:
      "👤 حسابي\n\n",

    cancel:
      "❌ تم إلغاء العملية.",

    back:
      "🏠 القائمة الرئيسية",

    error:
      "❌ حدث خطأ. حاول مرة أخرى."
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
    browse: "👀 Лише перегляд",
    account: "👤 Мій профіль",

    chooseProduct:
      "🛒 Надішліть назву товару.\n\nНаприклад: iPhone 14",

    chooseMax:
      "💰 Надішліть максимальну ціну.\n\nНаприклад: 25000",

    chooseRegion:
      "📍 Надішліть місто або область.\n\n" +
      "Наприклад: Київ\n\nАбо напишіть: будь-яка",

    searching: "🔎 Шукаю пропозиції на нашому ринку...",

    noResults:
      "🔎 Пошук завершено.\n\nПідходящих пропозицій зараз немає.",

    buySaved:
      "🛒 Ваш запит на купівлю збережено.",

    sellProduct:
      "📦 Надішліть назву товару.",

    sellDescription:
      "📝 Надішліть опис і стан товару.",

    sellPrice:
      "💰 Надішліть ціну продажу.\n\nНаприклад: 25000",

    sellRegion:
      "📍 Надішліть місто або область товару.\n\nНаприклад: Київ",

    photoRequired:
      "📸 Надішліть щонайменше одне фото товару.\n" +
      "Після кількох фото натисніть «Готово».",

    morePhotos:
      "📸 Надішліть ще фото або натисніть «Готово».",

    done: "✅ Готово",

    listingPublished:
      "✅ Вашу пропозицію опубліковано!",

    browseTitle:
      "👀 Пропозиції Telegram Marketplace",

    noListings:
      "Активних пропозицій зараз немає.",

    contact:
      "💬 Зв'язатися з продавцем",

    sellerNotice:
      "📩 Є покупець, зацікавлений у вашій пропозиції!",

    negotiationStarted:
      "💬 Переговори між покупцем і продавцем розпочато.",

    negotiationText:
      "💬 Надсилайте повідомлення для переговорів.\n\n/end — завершити.",

    dealOffer:
      "🤝 Погоджуєтесь завершити угоду за запропонованою ціною?",

    dealCreated:
      "🤝 Угоду зареєстровано.",

    accountText:
      "👤 Мій профіль\n\n",

    cancel:
      "❌ Операцію скасовано.",

    back:
      "🏠 Головне меню",

    error:
      "❌ Сталася помилка. Спробуйте ще раз."
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
    browse: "👀 Browse only",
    account: "👤 My account",

    chooseProduct:
      "🛒 Send the product name.\n\nExample: iPhone 14",

    chooseMax:
      "💰 Send the maximum price.\n\nExample: 25000",

    chooseRegion:
      "📍 Send the city or region.\n\n" +
      "Example: Kyiv\n\nOr type: any",

    searching:
      "🔎 Searching our marketplace...",

    noResults:
      "🔎 Search finished.\n\nNo matching offers were found.",

    buySaved:
      "🛒 Your purchase request has been saved.",

    sellProduct:
      "📦 Send the product name.",

    sellDescription:
      "📝 Send the product description and condition.",

    sellPrice:
      "💰 Send your selling price.\n\nExample: 25000",

    sellRegion:
      "📍 Send the city or region where the product is located.\n\nExample: Kyiv",

    photoRequired:
      "📸 Send at least one product photo.\n" +
      "After sending photos, press “Done”.",

    morePhotos:
      "📸 Send another photo or press “Done”.",

    done: "✅ Done",

    listingPublished:
      "✅ Your listing has been published!",

    browseTitle:
      "👀 Telegram Marketplace offers",

    noListings:
      "There are no active offers right now.",

    contact:
      "💬 Contact seller",

    sellerNotice:
      "📩 A buyer is interested in your listing!",

    negotiationStarted:
      "💬 Negotiation between buyer and seller has started.",

    negotiationText:
      "💬 Send your negotiation messages.\n\nUse /end to finish.",

    dealOffer:
      "🤝 Do you agree to complete the deal at the proposed price?",

    dealCreated:
      "🤝 Deal registered.",

    accountText:
      "👤 My account\n\n",

    cancel:
      "❌ Operation cancelled.",

    back:
      "🏠 Main menu",

    error:
      "❌ Something went wrong. Try again."
  }
};

function getUser(chatId) {
  return db.users[String(chatId)] || null;
}

function generateMemberId() {
  const number = db.counters.member++;
  return `TM-${String(number).padStart(6, "0")}`;
}

function setUser(chatId, data = {}) {
  const id = String(chatId);

  if (!db.users[id]) {
    db.users[id] = {
      chatId: id,
      memberId: generateMemberId(),
      language: null,
      agreedAt: null,
      name: null,
      phone: null,
      registeredAt: null,
      firstSeenAt: new Date().toISOString()
    };
  } else if (!db.users[id].memberId) {
    db.users[id].memberId = generateMemberId();
  }

  Object.assign(db.users[id], data);
  db.users[id].lastSeenAt = new Date().toISOString();

  saveDb();

  return db.users[id];
}

function t(chatId, key) {
  const user = getUser(chatId);
  const language = user?.language || "ar";

  return TEXT[language]?.[key] || TEXT.ar[key] || key;
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

async function telegram(method, body) {
  if (!TELEGRAM_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is missing");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
    }

    return result;
  } catch (error) {
    console.error("Telegram request error:", error);
    return null;
  }
}

async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text
  };

  if (keyboard) {
    body.reply_markup = keyboard;
  }

  return telegram("sendMessage", body);
}

async function sendPhoto(chatId, photo, caption, keyboard = null) {
  const body = {
    chat_id: chatId,
    photo
  };

  if (caption) {
    body.caption = caption;
  }

  if (keyboard) {
    body.reply_markup = keyboard;
  }

  return telegram("sendPhoto", body);
}

async function answerCallback(id) {
  return telegram("answerCallbackQuery", {
    callback_query_id: id
  });
}

async function notifyAdmin(text) {
  if (ADMIN_CHAT_ID) {
    await sendMessage(ADMIN_CHAT_ID, text);
  }
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

function mainKeyboard(chatId) {
  return {
    inline_keyboard: [
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
    ]
  };
}

function backKeyboard(chatId) {
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

function parsePrice(value) {
  const cleaned = String(value || "")
    .replace(/\s/g, "")
    .replace(/₴/g, "")
    .replace(",", ".");

  const number = Number(cleaned);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${Math.round(value).toLocaleString("uk-UA")} ₴`;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase();
}

function showWelcome(chatId) {
  return sendMessage(
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

function showMenu(chatId) {
  return sendMessage(
    chatId,
    t(chatId, "menuTitle"),
    mainKeyboard(chatId)
  );
}

function searchListings(product, maxPrice, region) {
  const wantedProduct = normalize(product);
  const wantedRegion = normalize(region);

  return db.listings
    .filter(listing => {
      if (listing.status !== "active") {
        return false;
      }

      if (listing.price > maxPrice) {
        return false;
      }

      const productName = normalize(listing.product);
      const listingRegion = normalize(listing.region);

      const productMatch =
        productName.includes(wantedProduct) ||
        wantedProduct.includes(productName);

      if (!productMatch) {
        return false;
      }

      const allRegions = [
        "الكل",
        "будь-яка",
        "any",
        "all"
      ];

      if (
        wantedRegion &&
        !allRegions.includes(wantedRegion)
      ) {
        if (
          !listingRegion.includes(wantedRegion) &&
          !wantedRegion.includes(listingRegion)
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);
}

function createBuyRequest(chatId, session) {
  const request = {
    id: db.counters.request++,
    buyerChatId: String(chatId),
    product: session.product,
    maxPrice: session.maxPrice,
    region: session.region,
    status: "open",
    createdAt: new Date().toISOString()
  };

  db.buyRequests.push(request);
  saveDb();

  return request;
}

function createListing(chatId, session) {
  const listing = {
    id: db.counters.listing++,
    sellerChatId: String(chatId),
    product: session.product,
    description: session.description,
    price: session.price,
    region: session.region,
    photos: session.photos || [],
    status: "active",
    createdAt: new Date().toISOString()
  };

  db.listings.push(listing);
  saveDb();

  return listing;
}

async function showBrowse(chatId) {
  const listings = db.listings
    .filter(x => x.status === "active")
    .slice(0, 10);

  if (!listings.length) {
    await sendMessage(
      chatId,
      t(chatId, "noListings"),
      backKeyboard(chatId)
    );
    return;
  }

  await sendMessage(chatId, t(chatId, "browseTitle"));

  for (const listing of listings) {
    const text =
      `📌 العرض #${listing.id}\n\n` +
      `🛒 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}\n\n` +
      `📝 ${listing.description || ""}`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: t(chatId, "contact"),
            callback_data: `contact_${listing.id}`
          }
        ]
      ]
    };

    if (listing.photos?.length) {
      await sendPhoto(
        chatId,
        listing.photos[0],
        text,
        keyboard
      );
    } else {
      await sendMessage(
        chatId,
        text,
        keyboard
      );
    }
  }

  logActivity(chatId, "browse");
}

async function sendSearchResults(chatId, session) {
  const results = searchListings(
    session.product,
    session.maxPrice,
    session.region
  );

  if (!results.length) {
    const request = createBuyRequest(chatId, session);

    await sendMessage(
      chatId,
      t(chatId, "noResults") +
      `\n\n🛒 ${session.product}` +
      `\n💰 حتى ${formatPrice(session.maxPrice)}` +
      `\n📍 ${session.region}` +
      `\n\n${t(chatId, "buySaved")}`,
      backKeyboard(chatId)
    );

    await notifyAdmin(
      `🔔 طلب شراء جديد #${request.id}\n\n` +
      `🛒 ${request.product}\n` +
      `💰 حتى ${formatPrice(request.maxPrice)}\n` +
      `📍 ${request.region}\n` +
      `👤 ${request.buyerChatId}`
    );

    return;
  }

  await sendMessage(
    chatId,
    `🔎 وجدنا ${results.length} عرض مناسب.`
  );

  for (const listing of results) {
    const text =
      `📌 العرض #${listing.id}\n\n` +
      `🛒 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}\n\n` +
      `📝 ${listing.description || ""}`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: t(chatId, "contact"),
            callback_data: `contact_${listing.id}`
          }
        ]
      ]
    };

    if (listing.photos?.length) {
      await sendPhoto(
        chatId,
        listing.photos[0],
        text,
        keyboard
      );
    } else {
      await sendMessage(
        chatId,
        text,
        keyboard
      );
    }
  }
}

function createNegotiation(buyerChatId, listing) {
  const existing = db.negotiations.find(
    n =>
      n.listingId === listing.id &&
      n.buyerChatId === String(buyerChatId) &&
      n.status === "active"
  );

  if (existing) {
    return existing;
  }

  const negotiation = {
    id: db.counters.negotiation++,
    listingId: listing.id,
    buyerChatId: String(buyerChatId),
    sellerChatId: String(listing.sellerChatId),
    status: "active",
    proposedPrice: null,
    createdAt: new Date().toISOString()
  };

  db.negotiations.push(negotiation);
  saveDb();

  return negotiation;
}

async function contactSeller(buyerChatId, listingId) {
  const listing = db.listings.find(
    x =>
      x.id === listingId &&
      x.status === "active"
  );

  if (!listing) {
    await sendMessage(
      buyerChatId,
      "❌ هذا العرض لم يعد متاحًا."
    );
    return;
  }

  if (
    String(listing.sellerChatId) ===
    String(buyerChatId)
  ) {
    await sendMessage(
      buyerChatId,
      "❌ لا يمكنك التواصل مع نفسك."
    );
    return;
  }

  const negotiation = createNegotiation(
    buyerChatId,
    listing
  );

  sessions[buyerChatId] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  sessions[listing.sellerChatId] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  await sendMessage(
    buyerChatId,
    `💬 تم فتح التفاوض للعرض #${listing.id}.\n\n` +
    `🛒 ${listing.product}\n` +
    `💰 السعر: ${formatPrice(listing.price)}\n\n` +
    t(buyerChatId, "negotiationText")
  );

  await sendMessage(
    listing.sellerChatId,
    t(listing.sellerChatId, "sellerNotice") +
    `\n\n📌 العرض #${listing.id}\n` +
    `🛒 ${listing.product}\n` +
    `💰 السعر: ${formatPrice(listing.price)}\n\n` +
    t(listing.sellerChatId, "negotiationText")
  );

  await notifyAdmin(
    `💬 تفاوض جديد #${negotiation.id}\n` +
    `📦 العرض #${listing.id}\n` +
    `👤 المشتري: ${buyerChatId}\n` +
    `👤 البائع: ${listing.sellerChatId}`
  );
}

async function forwardNegotiation(chatId, text) {
  const session = sessions[chatId];

  if (!session?.negotiationId) {
    return false;
  }

  const negotiation = db.negotiations.find(
    n =>
      n.id === session.negotiationId &&
      n.status === "active"
  );

  if (!negotiation) {
    return false;
  }

  const other =
    String(negotiation.buyerChatId) === String(chatId)
      ? negotiation.sellerChatId
      : negotiation.buyerChatId;

  await sendMessage(
    other,
    `💬 رسالة من الطرف الآخر:\n\n${text}`
  );

  return true;
}

async function createDeal(negotiation, price) {
  const deal = {
    id: db.counters.deal++,
    negotiationId: negotiation.id,
    listingId: negotiation.listingId,
    buyerChatId: negotiation.buyerChatId,
    sellerChatId: negotiation.sellerChatId,
    amount: price,
    commission: price * 0.05,
    buyerCommission: price * 0.025,
    sellerCommission: price * 0.025,
    status: "agreed",
          createdAt: new Date().toISOString()
  };

  negotiation.status = "agreed";
  negotiation.proposedPrice = price;

  db.deals.push(deal);

  const listing = db.listings.find(
    x => x.id === negotiation.listingId
  );

  if (listing) {
    listing.status = "reserved";
  }

  saveDb();

  const buyerText =
    `${t(deal.buyerChatId, "dealCreated")}\n\n` +
    `🤝 الصفقة #${deal.id}\n` +
    `💰 القيمة: ${formatPrice(deal.amount)}\n` +
    `💵 عمولة المنصة 5%: ${formatPrice(deal.commission)}\n` +
    `المشتري 2.5%: ${formatPrice(deal.buyerCommission)}`;

  const sellerText =
    `${t(deal.sellerChatId, "dealCreated")}\n\n` +
    `🤝 الصفقة #${deal.id}\n` +
    `💰 القيمة: ${formatPrice(deal.amount)}\n` +
    `💵 عمولة المنصة 5%: ${formatPrice(deal.commission)}\n` +
    `البائع 2.5%: ${formatPrice(deal.sellerCommission)}`;

  await sendMessage(
    deal.buyerChatId,
    buyerText
  );

  await sendMessage(
    deal.sellerChatId,
    sellerText
  );

  await notifyAdmin(
    `🤝 صفقة جديدة #${deal.id}\n\n` +
    `📦 العرض: #${deal.listingId}\n` +
    `💰 القيمة: ${formatPrice(deal.amount)}\n` +
    `💵 العمولة 5%: ${formatPrice(deal.commission)}`
  );
}

async function handleCallback(query) {
  await answerCallback(query.id);

  if (!query.message) {
    return;
  }

  const chatId = query.message.chat.id;
  const data = query.data || "";

  setUser(chatId, {
    username: query.from?.username || null,
    firstName: query.from?.first_name || null
  });

  if (data.startsWith("lang_")) {
    const language = data.substring(5);

    if (!TEXT[language]) {
      return;
    }

    setUser(chatId, {
      language
    });

    sessions[chatId] = {
      step: "welcome"
    };

    await showWelcome(chatId);
    return;
  }

  if (data === "agree") {
    setUser(chatId, {
      agreedAt: new Date().toISOString()
    });

    sessions[chatId] = {
      step: "menu"
    };

    await showMenu(chatId);
    return;
  }

  if (data === "menu") {
    sessions[chatId] = {
      step: "menu"
    };

    await showMenu(chatId);
    return;
  }

  if (data === "buy") {
    sessions[chatId] = {
      step: "buy_product"
    };

    await sendMessage(
      chatId,
      t(chatId, "chooseProduct")
    );

    return;
  }

  if (data === "sell") {
    sessions[chatId] = {
      step: "sell_product",
      photos: []
    };

    await sendMessage(
      chatId,
      t(chatId, "sellProduct")
    );

    return;
  }

  if (data === "browse") {
    sessions[chatId] = {
      step: "menu"
    };

    await showBrowse(chatId);
    return;
  }

  if (data === "account") {
    const listings = db.listings.filter(
      x =>
        String(x.sellerChatId) ===
        String(chatId)
    );

    const requests = db.buyRequests.filter(
      x =>
        String(x.buyerChatId) ===
        String(chatId)
    );

    const deals = db.deals.filter(
      x =>
        String(x.buyerChatId) === String(chatId) ||
        String(x.sellerChatId) === String(chatId)
    );

    await sendMessage(
      chatId,
      t(chatId, "accountText") +
      `📦 عروض البيع: ${listings.length}\n` +
      `🛒 طلبات الشراء: ${requests.length}\n` +
      `🤝 الصفقات: ${deals.length}`,
      backKeyboard(chatId)
    );

    return;
  }

  if (data === "done_photos") {
    const session = sessions[chatId];

    if (!session?.photos?.length) {
      await sendMessage(
        chatId,
        t(chatId, "photoRequired")
      );
      return;
    }

    const listing = createListing(
      chatId,
      session
    );

    await sendMessage(
      chatId,
      `${t(chatId, "listingPublished")}\n\n` +
      `📌 العرض #${listing.id}\n` +
      `🛒 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}`
    );

    await notifyAdmin(
      `📦 عرض بيع جديد #${listing.id}\n\n` +
      `🛒 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}\n` +
      `👤 البائع: ${listing.sellerChatId}`
    );

    sessions[chatId] = {
      step: "menu"
    };

    await showMenu(chatId);
    return;
  }

  if (data.startsWith("contact_")) {
    const listingId = Number(
      data.substring(8)
    );

    if (Number.isInteger(listingId)) {
      await contactSeller(
        chatId,
        listingId
      );
    }

    return;
  }

  if (data.startsWith("approve_")) {
    const negotiationId = Number(
      data.substring(8)
    );

    const negotiation =
      db.negotiations.find(
        n =>
          n.id === negotiationId &&
          n.status === "active"
      );

    if (!negotiation) {
      await sendMessage(
        chatId,
        "❌ التفاوض غير متاح."
      );
      return;
    }

    const price =
      negotiation.proposedPrice;

    if (!price) {
      await sendMessage(
        chatId,
        "❌ لا يوجد سعر مقترح."
      );
      return;
    }

    await createDeal(
      negotiation,
      price
    );

    return;
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = String(
    message.text || ""
  ).trim();

  setUser(chatId, {
    username: message.from?.username || null,
    firstName: message.from?.first_name || null
  });

  if (message.photo?.length) {
    const session = sessions[chatId];

    if (session?.step === "sell_photos") {
      session.photos.push(
        message.photo[
          message.photo.length - 1
        ].file_id
      );

      await sendMessage(
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
    const user = getUser(chatId);

    if (!user?.language) {
      sessions[chatId] = {
        step: "language"
      };

      await sendMessage(
        chatId,
        TEXT.ar.lang,
        languageKeyboard()
      );

      return;
    }

    if (!user.agreedAt) {
      await showWelcome(chatId);
      return;
    }

    sessions[chatId] = {
      step: "menu"
    };

    await showMenu(chatId);
    return;
  }

  if (!getUser(chatId)?.language) {
    await sendMessage(
      chatId,
      TEXT.ar.lang,
      languageKeyboard()
    );

    return;
  }

  if (text === "/cancel") {
    sessions[chatId] = {
      step: "menu"
    };

    await sendMessage(
      chatId,
      t(chatId, "cancel")
    );

    await showMenu(chatId);
    return;
  }

  if (text === "/menu") {
    sessions[chatId] = {
      step: "menu"
    };

    await showMenu(chatId);
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
      from: message.from,
      data: "account"
    });

    return;
  }

  if (text === "/end") {
    const session = sessions[chatId];

    if (session?.step === "negotiation") {
      const negotiation =
        db.negotiations.find(
          n =>
            n.id === session.negotiationId
        );

      if (negotiation) {
        negotiation.status = "closed";
        saveDb();
      }

      sessions[chatId] = {
        step: "menu"
      };

      await sendMessage(
        chatId,
        "❌ تم إنهاء التفاوض."
      );

      await showMenu(chatId);
      return;
    }
  }

  const session = sessions[chatId];

  if (session?.step === "buy_product") {
    if (!text) {
      return;
    }

    session.product = text;
    session.step = "buy_max_price";

    await sendMessage(
      chatId,
      t(chatId, "chooseMax")
    );

    return;
  }

  if (session?.step === "buy_max_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendMessage(
        chatId,
        t(chatId, "chooseMax")
      );

      return;
    }

    session.maxPrice = price;
    session.step = "buy_region";

    await sendMessage(
      chatId,
      t(chatId, "chooseRegion")
    );

    return;
  }

  if (session?.step === "buy_region") {
    if (!text) {
      return;
    }

    session.region = text;
    session.step = "buy_results";

    await sendMessage(
      chatId,
      t(chatId, "searching") +
      `\n\n🛒 ${session.product}` +
      `\n💰 ${formatPrice(session.maxPrice)}` +
      `\n📍 ${session.region}`
    );

    await sendSearchResults(
      chatId,
      session
    );

    return;
  }

  if (session?.step === "sell_product") {
    if (!text) {
      return;
    }

    session.product = text;
    session.step = "sell_description";

    await sendMessage(
      chatId,
      t(chatId, "sellDescription")
    );

    return;
  }

  if (session?.step === "sell_description") {
    if (!text) {
      return;
    }

    session.description = text;
    session.step = "sell_price";

    await sendMessage(
      chatId,
      t(chatId, "sellPrice")
    );

    return;
  }

  if (session?.step === "sell_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendMessage(
        chatId,
        t(chatId, "sellPrice")
      );

      return;
    }

    session.price = price;
    session.step = "sell_region";

    await sendMessage(
      chatId,
      t(chatId, "sellRegion")
    );

    return;
  }

  if (session?.step === "sell_region") {
    if (!text) {
      return;
    }

    session.region = text;
    session.step = "sell_photos";

    await sendMessage(
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
    if (
      text &&
      await forwardNegotiation(
        chatId,
        text
      )
    ) {
      return;
    }
  }

  await sendMessage(
    chatId,
    "ℹ️ استخدم /start للبدء من جديد."
  );
}

async function processWebhook(body) {
  try {
    if (body.callback_query) {
      await handleCallback(
        body.callback_query
      );
      return;
    }

    if (body.message) {
      await handleMessage(
        body.message
      );
    }
  } catch (error) {
    console.error(
      "Webhook processing error:",
      error
    );
  }
}

const server = http.createServer(
  (req, res) => {
    if (
      req.method === "GET" &&
      req.url === "/"
    ) {
      res.writeHead(200, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      res.end(`
        <!doctype html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport"
            content="width=device-width,initial-scale=1">
          <title>Telegram Marketplace</title>
        </head>
        <body>
          <h1>🛍️ Telegram Marketplace</h1>
          <p>الخدمة تعمل بنجاح.</p>
        </body>
        </html>
      `);

      return;
    }

    if (
      req.method === "POST" &&
      req.url === "/webhook"
    ) {
      let data = "";

      req.on(
        "data",
        chunk => {
          data += chunk;
        }
      );

      req.on(
        "end",
        () => {
          try {
            const body =
              JSON.parse(data);

            res.writeHead(200, {
              "Content-Type":
                "text/plain"
            });

            res.end("OK");

            processWebhook(body);
          } catch (error) {
            console.error(
              "JSON error:",
              error
            );

            res.writeHead(400);
            res.end("Bad Request");
          }
        }
      );

      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  }
);

if (!TELEGRAM_TOKEN) {
  console.error(
    "ERROR: TELEGRAM_BOT_TOKEN is not configured."
  );
}

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Telegram Marketplace running on port ${PORT}`
    );
  }
);