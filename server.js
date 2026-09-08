const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;
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
    deal: 1
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
    browse: "👀 للتصفح فقط",
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
    browseTitle: "👀 عروض سوق تيليجرام",
    noListings: "لا توجد عروض نشطة حاليًا.",
    contact: "💬 تواصل مع البائع",
    contacted: "✅ تم إرسال اهتمامك بالعرض إلى البائع.",
    sellerNotice: "📩 لديك مشتري مهتم بعرضك!",
    negotiationStarted: "💬 بدأ التفاوض بين المشتري والبائع.",
    negotiationText: "💬 أرسل رسالتك للتفاوض.\n\nاكتب /end لإنهاء التفاوض.",
    dealOffer: "🤝 هل توافق على إتمام الصفقة بالسعر المتفق عليه؟",
    dealCreated: "🤝 تم تسجيل الصفقة.",
    accountText: "👤 حسابي\n\n",
    cancel: "❌ تم إلغاء العملية.",
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
    browse: "👀 Лише перегляд",
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
    browseTitle: "👀 Пропозиції Telegram Marketplace",
    noListings: "Активних пропозицій зараз немає.",
    contact: "💬 Зв'язатися з продавцем",
    contacted: "✅ Інтерес до пропозиції надіслано продавцю.",
    sellerNotice: "📩 Є покупець, зацікавлений у вашій пропозиції!",
    negotiationStarted: "💬 Переговори між покупцем і продавцем розпочато.",
    negotiationText: "💬 Надсилайте повідомлення для переговорів.\n\n/end — завершити.",
    dealOffer: "🤝 Погоджуєтесь завершити угоду за узгодженою ціною?",
    dealCreated: "🤝 Угоду зареєстровано.",
    accountText: "👤 Мій профіль\n\n",
    cancel: "❌ Операцію скасовано.",
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
    browse: "👀 Browse only",
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
    browseTitle: "👀 Telegram Marketplace offers",
    noListings: "There are no active offers right now.",
    contact: "💬 Contact seller",
    contacted: "✅ Your interest was sent to the seller.",
    sellerNotice: "📩 A buyer is interested in your listing!",
    negotiationStarted: "💬 Negotiation between buyer and seller has started.",
    negotiationText: "💬 Send your negotiation messages.\n\nUse /end to finish.",
    dealOffer: "🤝 Do you agree to complete the deal at the agreed price?",
    dealCreated: "🤝 Deal registered.",
    accountText: "👤 My account\n\n",
    cancel: "❌ Operation cancelled.",
    back: "🏠 Main menu",
    error: "❌ Something went wrong. Try again.",
    adminFallback: "ADMIN_CHAT_ID is not configured."
  }
};

function t(chatId, key) {
  const lang = db.users[chatId]?.language || "ar";
  return TEXT[lang]?.[key] || TEXT.ar[key] || key;
}

function setUser(chatId, data = {}) {
  if (!db.users[chatId]) {
    db.users[chatId] = {
      chatId: String(chatId),
      language: null,
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

function logActivity(chatId, type, extra = {}) {
  db.activities.push({
    id: db.activities.length + 1,
    chatId: String(chatId),
    type,
    ...extra,
    createdAt: new Date().toISOString()
  });
  if (db.activities.length > 10000) db.activities.shift();
  saveDb();
}

async function sendTelegram(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_TOKEN) return;
  const body = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    console.error("Telegram sendMessage error:", await response.text());
  }
}

async function sendPhoto(chatId, photoId, caption = "", replyMarkup = null) {
  const body = { chat_id: chatId, photo: photoId };
  if (caption) body.caption = caption;
  if (replyMarkup) body.reply_markup = replyMarkup;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    console.error("Telegram sendPhoto error:", await response.text());
  }
}

async function answerCallback(callbackId) {
  if (!TELEGRAM_TOKEN) return;
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId })
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
  if (price === null || price === undefined) return "—";
  return `${Math.round(price).toLocaleString("uk-UA")} ₴`;
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}
      if (!productMatch) return false;

      if (
        wantedRegion &&
        wantedRegion !== "الكل" &&
        wantedRegion !== "أي" &&
        wantedRegion !== "any" &&
        wantedRegion !== "будь-яка"
      ) {
        if (!lr.includes(wantedRegion) && !wantedRegion.includes(lr)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createBuyRequest(chatId, data) {
  const id = db.counters.request++;

  const request = {
    id,
    buyerChatId: String(chatId),
    product: data.product,
    maxPrice: data.maxPrice,
    region: data.region,
    status: "active",
    createdAt: new Date().toISOString()
  };

  db.buyRequests.push(request);
  saveDb();

  logActivity(chatId, "buy_request_created", {
    requestId: id,
    product: data.product,
    maxPrice: data.maxPrice,
    region: data.region
  });

  return request;
}

function createListing(chatId, data) {
  const id = db.counters.listing++;

  const listing = {
    id,
    sellerChatId: String(chatId),
    product: data.product,
    description: data.description || "",
    price: data.price,
    region: data.region,
    photos: Array.isArray(data.photos) ? data.photos : [],
    status: "active",
    createdAt: new Date().toISOString()
  };

  db.listings.push(listing);
  saveDb();

  return listing;
}

function getListing(id) {
  return db.listings.find((item) => Number(item.id) === Number(id));
}

function createNegotiation(buyerChatId, sellerChatId, listingId) {
  const id = db.counters.negotiation++;

  const negotiation = {
    id,
    buyerChatId: String(buyerChatId),
    sellerChatId: String(sellerChatId),
    listingId: Number(listingId),
    status: "active",
    messages: [],
    createdAt: new Date().toISOString()
  };

  db.negotiations.push(negotiation);
  saveDb();

  return negotiation;
}

function getNegotiation(id) {
  return db.negotiations.find(
    (item) => Number(item.id) === Number(id)
  );
}

function findActiveNegotiationForUser(chatId) {
  return db.negotiations.find(
    (item) =>
      item.status === "active" &&
      (String(item.buyerChatId) === String(chatId) ||
        String(item.sellerChatId) === String(chatId))
  );
}

function createDeal(negotiation, finalPrice) {
  const price = Number(finalPrice);

  const buyerCommission = price * 0.025;
  const sellerCommission = price * 0.025;
  const totalCommission = buyerCommission + sellerCommission;

  const id = db.counters.deal++;

  const deal = {
    id,
    negotiationId: negotiation.id,
    listingId: negotiation.listingId,
    buyerChatId: String(negotiation.buyerChatId),
    sellerChatId: String(negotiation.sellerChatId),
    price,
    buyerCommission,
    sellerCommission,
    totalCommission,
    status: "agreed",
    createdAt: new Date().toISOString()
  };

  db.deals.push(deal);
  negotiation.status = "deal_created";

  saveDb();

  return deal;
}

function userDisplay(user) {
  if (!user) return "غير معروف";

  const name = [
    user.firstName || "",
    user.lastName || ""
  ].filter(Boolean).join(" ");

  if (user.username) {
    return `${name || "User"} (@${user.username})`;
  }

  return name || `ID ${user.chatId}`;
}

async function sendListing(chatId, listing, langChatId = chatId) {
  const caption =
    `📦 ${listing.product}\n\n` +
    `📝 ${listing.description || "—"}\n` +
    `💰 ${formatPrice(listing.price)}\n` +
    `📍 ${listing.region}\n\n` +
    `🆔 العرض #${listing.id}`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: t(langChatId, "contact"),
          callback_data: `contact_${listing.id}`
        }
      ]
    ]
  };

  if (listing.photos && listing.photos.length > 0) {
    await sendPhoto(
      chatId,
      listing.photos[0],
      caption,
      keyboard
    );
  } else {
    await sendTelegram(chatId, caption, keyboard);
  }

  logActivity(chatId, "listing_viewed", {
    listingId: listing.id,
    product: listing.product
  });

  await notifyAdmin(
    `👀 مشاهدة عرض\n\n` +
    `🆔 العرض: #${listing.id}\n` +
    `📦 المنتج: ${listing.product}\n` +
    `👤 المستخدم: ${chatId}`
  );
}

async function showBrowse(chatId) {
  const listings = db.listings
    .filter((listing) => listing.status === "active")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);

  if (listings.length === 0) {
    await sendTelegram(chatId, t(chatId, "noListings"), {
      inline_keyboard: [
        [{ text: t(chatId, "back"), callback_data: "menu" }]
      ]
    });
    return;
  }

  await sendTelegram(chatId, t(chatId, "browseTitle"));

  for (const listing of listings) {
    await sendListing(chatId, listing, chatId);
  }
}

async function showSearchResults(chatId, results) {
  if (!results.length) {
    await sendTelegram(chatId, t(chatId, "noResults"), {
      inline_keyboard: [
        [{ text: t(chatId, "back"), callback_data: "menu" }]
      ]
    });
    return;
  }

  await sendTelegram(
    chatId,
    `🔎 تم العثور على ${results.length} عرض مناسب:`
  );

  for (const listing of results.slice(0, 20)) {
    await sendListing(chatId, listing, chatId);
  }
}

async function notifyBuyerAboutListing(buyerChatId, listing) {
  await sendTelegram(
    buyerChatId,
    `📦 وجدنا عرضًا قد يناسب طلبك!\n\n` +
    `📦 ${listing.product}\n` +
    `💰 ${formatPrice(listing.price)}\n` +
    `📍 ${listing.region}`,
    {
      inline_keyboard: [
        [
          {
            text: t(buyerChatId, "contact"),
            callback_data: `contact_${listing.id}`
          }
        ]
      ]
    }
  );
}

async function startNegotiation(buyerChatId, listingId) {
  const listing = getListing(listingId);

  if (!listing || listing.status !== "active") {
    await sendTelegram(
      buyerChatId,
      "❌ هذا العرض لم يعد متاحًا."
    );
    return;
  }

  if (String(listing.sellerChatId) === String(buyerChatId)) {
    await sendTelegram(
      buyerChatId,
      "❌ لا يمكنك التفاوض على عرضك الخاص."
    );
    return;
  }

  const existing = db.negotiations.find(
    (item) =>
      item.status === "active" &&
      item.listingId === Number(listingId) &&
      String(item.buyerChatId) === String(buyerChatId)
  );

  if (existing) {
    sessions[buyerChatId] = {
      step: "negotiation",
      negotiationId: existing.id
    };

    await sendTelegram(
      buyerChatId,
      t(buyerChatId, "negotiationText")
    );
    return;
  }

  const negotiation = createNegotiation(
    buyerChatId,
    listing.sellerChatId,
    listing.id
  );

  sessions[buyerChatId] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  sessions[listing.sellerChatId] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  logActivity(buyerChatId, "negotiation_started", {
    negotiationId: negotiation.id,
    listingId: listing.id,
    sellerChatId: listing.sellerChatId
  });

  await sendTelegram(
    buyerChatId,
    t(buyerChatId, "contacted")
  );

  await sendTelegram(
    listing.sellerChatId,
    t(listing.sellerChatId, "sellerNotice") +
      `\n\n📦 ${listing.product}\n` +
      `💰 ${formatPrice(listing.price)}\n` +
      `📍 ${listing.region}\n\n` +
      t(listing.sellerChatId, "negotiationText")
  );

  await sendTelegram(
    buyerChatId,
    t(buyerChatId, "negotiationStarted") +
      "\n\n" +
      t(buyerChatId, "negotiationText")
  );

  await notifyAdmin(
    `💬 بدأ تفاوض جديد\n\n` +
    `🆔 التفاوض: #${negotiation.id}\n` +
    `🆔 العرض: #${listing.id}\n` +
    `🛒 المشتري: ${buyerChatId}\n` +
    `📦 البائع: ${listing.sellerChatId}\n` +
    `📦 المنتج: ${listing.product}`
  );
}

async function forwardNegotiationMessage(
  fromChatId,
  negotiation,
  text
) {
  const receiver =
    String(negotiation.buyerChatId) === String(fromChatId)
      ? negotiation.sellerChatId
      : negotiation.buyerChatId;

  negotiation.messages.push({
    fromChatId: String(fromChatId),
    text,
    createdAt: new Date().toISOString()
  });

  saveDb();

  await sendTelegram(
    receiver,
    `💬 رسالة من الطرف الآخر:\n\n${text}`
  );

  await notifyAdmin(
    `💬 رسالة تفاوض\n\n` +
    `🆔 التفاوض: #${negotiation.id}\n` +
    `👤 من: ${fromChatId}\n` +
    `👤 إلى: ${receiver}`
  );
}

async function showAccount(chatId) {
  const user = db.users[chatId] || {};
  const myListings = db.listings.filter(
    (listing) => String(listing.sellerChatId) === String(chatId)
  );
  const myRequests = db.buyRequests.filter(
    (request) => String(request.buyerChatId) === String(chatId)
  );
  const myDeals = db.deals.filter(
    (deal) =>
      String(deal.buyerChatId) === String(chatId) ||
      String(deal.sellerChatId) === String(chatId)
  );

  const text =
    t(chatId, "accountText") +
    `🆔 ID: ${chatId}\n` +
    `🌐 اللغة: ${user.language || "—"}\n\n` +
    `📦 عروض البيع: ${myListings.length}\n` +
    `🛒 طلبات الشراء: ${myRequests.length}\n` +
    `🤝 الصفقات: ${myDeals.length}`;

  await sendTelegram(
    chatId,
    text,
    accountKeyboard(chatId)
  );
}
async function showBrowse(chatId) {
  logActivity(chatId, "browse_marketplace");
  const active = db.listings.filter(x => x.status === "active").slice(0, 10);

  if (!active.length) {
    await sendTelegram(chatId, t(chatId, "noListings"), accountKeyboard(chatId));
    return;
  }

  await sendTelegram(chatId, t(chatId, "browseTitle"));

  for (const item of active) {
    const caption =
      `📌 #${item.id}\n\n` +
      `🛒 ${item.product}\n` +
      `💰 ${formatPrice(item.price)}\n` +
      `📍 ${item.region}\n\n` +
      `${item.description || ""}`;

    if (item.photos?.length) {
      await sendPhoto(chatId, item.photos[0], caption, {
        inline_keyboard: [[
          { text: t(chatId, "contact"), callback_data: `contact_${item.id}` }
        ]]
      });
    } else {
      await sendTelegram(chatId, caption, {
        inline_keyboard: [[
          { text: t(chatId, "contact"), callback_data: `contact_${item.id}` }
        ]]
      });
    }

    logActivity(chatId, "view_listing", { listingId: item.id });
    await notifyAdmin(
      `👀 مشاهدة عرض #${item.id}\n` +
      `🛒 ${item.product}\n` +
      `👤 المستخدم: ${chatId}`
    );
  }
}

async function sendMarketplaceResults(chatId, session, results) {
  if (!results.length) {
    const request = createBuyRequest(chatId, session);
    logActivity(chatId, "buy_request_created", { requestId: request.id });

    await sendTelegram(
      chatId,
      t(chatId, "noResults") +
      `\n\n🛒 ${session.product}\n💰 ${formatPrice(session.maxPrice)}\n📍 ${session.region}\n\n` +
      t(chatId, "buySaved"),
      {
        inline_keyboard: [
          [{ text: t(chatId, "browse"), callback_data: "browse" }],
          [{ text: t(chatId, "back"), callback_data: "menu" }]
        ]
      }
    );

    await notifyAdmin(
      `🔔 طلب شراء جديد #${request.id}\n\n` +
      `🛒 ${request.product}\n` +
      `💰 حتى ${formatPrice(request.maxPrice)}\n` +
      `📍 ${request.region}\n` +
      `👤 المستخدم: ${request.buyerChatId}`
    );
    return;
  }

  await sendTelegram(
    chatId,
    `🔎 وجدنا ${results.length} عرض/عروض مناسبة.`
  );
  for (const item of results) {
    logActivity(chatId, "view_matching_listing", {
      listingId: item.id,
      product: session.product
    });

    const message =
      `📌 عرض #${item.id}\n\n` +
      `🛒 ${item.product}\n` +
      `💰 ${formatPrice(item.price)}\n` +
      `📍 ${item.region}\n\n` +
      `📝 ${item.description || ""}`;

    const markup = {
      inline_keyboard: [[
        { text: t(chatId, "contact"), callback_data: `contact_${item.id}` }
      ]]
    };

    if (item.photos?.length) {
      await sendPhoto(chatId, item.photos[0], message, markup);
    } else {
      await sendTelegram(chatId, message, markup);
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
    if (existing) return existing;
    const message =
      `📌 عرض #${item.id}\n\n` +
      `🛒 ${item.product}\n` +
      `💰 ${formatPrice(item.price)}\n` +
      `📍 ${item.region}\n\n` +
      `📝 ${item.description || ""}`;

    const markup = {
      inline_keyboard: [[
        { text: t(chatId, "contact"), callback_data: `contact_${item.id}` }
      ]]
    };

    if (item.photos?.length) {
      await sendPhoto(chatId, item.photos[0], message, markup);
    } else {
      await sendTelegram(chatId, message, markup);
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

  if (existing) return existing;

  const negotiation = {
    id: db.counters.negotiation++,
    listingId: listing.id,
    buyerChatId: String(buyerChatId),
    sellerChatId: String(listing.sellerChatId),
    proposedPrice: listing.price,
    status: "active",
    createdAt: new Date().toISOString()
  };

  db.negotiations.push(negotiation);
  saveDb();
  return negotiation;
}
async function contactSeller(buyerChatId, listingId) {
  const listing = db.listings.find(
    x => x.id === listingId && x.status === "active"
  );

  if (!listing) {
    await sendTelegram(buyerChatId, "❌ هذا العرض لم يعد متاحًا.");
    return;
  }

  if (String(listing.sellerChatId) === String(buyerChatId)) {
    await sendTelegram(buyerChatId, "❌ لا يمكنك التواصل مع نفسك.");
    return;
  }

  const negotiation = createNegotiation(buyerChatId, listing);

  sessions[buyerChatId] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  await sendTelegram(
    buyerChatId,
    `💬 تم فتح التفاوض للعرض #${listing.id}.\n\n` +
    `🛒 ${listing.product}\n` +
    `💰 السعر المطلوب: ${formatPrice(listing.price)}\n\n` +
    t(buyerChatId, "negotiationText")
  );

  sessions[listing.sellerChatId] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  await sendTelegram(
    listing.sellerChatId,
    t(listing.sellerChatId, "sellerNotice") +
    `\n\n🆔 العرض: #${listing.id}\n` +
    `🛒 ${listing.product}\n` +
    `💰 ${formatPrice(listing.price)}\n\n` +
    t(listing.sellerChatId, "negotiationText")
  );

  logActivity(buyerChatId, "negotiation_started", {
    negotiationId: negotiation.id,
    listingId
  });

  await notifyAdmin(
    `💬 بدأ تفاوض #${negotiation.id}\n` +
    `📦 العرض: #${listing.id}\n` +
    `👤 المشتري: ${buyerChatId}\n` +
    `👤 البائع: ${listing.sellerChatId}`
  );
}

async function forwardNegotiationMessage(chatId, text) {
  const session = sessions[chatId];
  const negotiation = db.negotiations.find(
    n => n.id === session?.negotiationId && n.status === "active"
  );

  if (!negotiation) return false;

  const other =
    String(negotiation.buyerChatId) === String(chatId)
      ? negotiation.sellerChatId
      : negotiation.buyerChatId;

  await sendTelegram(
    other,
    `💬 رسالة من الطرف الآخر:\n\n${text}`
  );

  logActivity(chatId, "negotiation_message", {
    negotiationId: negotiation.id
  });

  return true;
}

async function createDeal(negotiation, agreedPrice) {
  const deal = {
    id: db.counters.deal++,
    negotiationId: negotiation.id,
    listingId: negotiation.listingId,
    buyerChatId: negotiation.buyerChatId,
    sellerChatId: negotiation.sellerChatId,
    amount: agreedPrice,
    commission: agreedPrice * 0.05,
    buyerCommission: agreedPrice * 0.025,
    sellerCommission: agreedPrice * 0.025,
    status: "agreed",
    createdAt: new Date().toISOString()
  };

  negotiation.status = "agreed";
  negotiation.agreedPrice = agreedPrice;
  db.deals.push(deal);
  saveDb();

  const listing = db.listings.find(x => x.id === negotiation.listingId);
  if (listing) listing.status = "reserved";
  saveDb();

  await sendTelegram(
    negotiation.buyerChatId,
    `${t(negotiation.buyerChatId, "dealCreated")}\n\n` +
    `🤝 الصفقة #${deal.id}\n` +
    `💰 القيمة: ${formatPrice(deal.amount)}\n` +
    `💵 عمولة المنصة: ${formatPrice(deal.commission)}`
  );

  await sendTelegram(
    negotiation.sellerChatId,
    `${t(negotiation.sellerChatId, "dealCreated")}\n\n` +
    `🤝 الصفقة #${deal.id}\n` +
    `💰 القيمة: ${formatPrice(deal.amount)}\n` +
    `💵 عمولة المنصة: ${formatPrice(deal.commission)}`
  );

  await notifyAdmin(
    `🤝 صفقة جديدة #${deal.id}\n\n` +
    `📦 العرض: #${deal.listingId}\n` +
    `💰 القيمة: ${formatPrice(deal.amount)}\n` +
    `💵 العمولة: ${formatPrice(deal.commission)}\n` +
    `👤 المشتري: ${deal.buyerChatId}\n` +
    `👤 البائع: ${deal.sellerChatId}`
  );

  logActivity(negotiation.buyerChatId, "deal_created", {
    dealId: deal.id,
    listingId: deal.listingId
  });
}
async function handleCallback(query) {
  await answerCallback(query.id);
  if (!query.message) return;

  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("lang_")) {
    const language = data.slice(5);
    if (!TEXT[language]) return;

    setUser(chatId, { language });
    logActivity(chatId, "language_selected", { language });
    await showWelcome(chatId);
    return;
  }

  if (data === "agree") {
    setUser(chatId, { agreedAt: new Date().toISOString() });
    logActivity(chatId, "entered_marketplace");
    await showMainMenu(chatId);
    return;
  }

  if (data === "menu") {
    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }

  if (data === "buy") {
    sessions[chatId] = { step: "buy_product" };
    logActivity(chatId, "start_buy");
    await sendTelegram(chatId, t(chatId, "chooseProduct"));
    return;
  }

  if (data === "sell") {
    sessions[chatId] = { step: "sell_product", photos: [] };
    logActivity(chatId, "start_sell");
    await sendTelegram(chatId, t(chatId, "sellProduct"));
    return;
  }

  if (data === "browse") {
    sessions[chatId] = { step: "menu" };
    await showBrowse(chatId);
    return;
  }

  if (data === "account") {
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
      `📦 عروض البيع: ${mine.length}\n` +
      `🛒 طلبات الشراء: ${buys.length}\n` +
      `🤝 الصفقات: ${deals.length}`,
      accountKeyboard(chatId)
    );
    return;
  }
  if (data === "done_photos") {
    const session = sessions[chatId];
    if (!session?.photos?.length) {
      await sendTelegram(chatId, t(chatId, "photoRequired"));
      return;
    }

    if (!session.product || !session.price || !session.region) {
      await sendTelegram(chatId, t(chatId, "error"));
      return;
    }

    const listing = createListing(chatId, session);
    logActivity(chatId, "listing_published", { listingId: listing.id });

    await sendTelegram(
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
      `📸 الصور: ${listing.photos.length}\n` +
      `👤 البائع: ${listing.sellerChatId}`
    );

    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }
  if (data.startsWith("contact_")) {
    const listingId = Number(data.slice(8));
    if (Number.isInteger(listingId)) {
      await contactSeller(chatId, listingId);
    }
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

    const session = sessions[chatId];
    const price = session?.proposedPrice;
    if (!price) {
      await sendTelegram(chatId, "❌ لا يوجد سعر متفق عليه.");
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
      await sendTelegram(chatId, t(chatId, "morePhotos"), {
        inline_keyboard: [[
          { text: t(chatId, "done"), callback_data: "done_photos" }
        ]]
      });
      return;
    }
  }

  if (text === "/start") {
    setUser(chatId);
    logActivity(chatId, "start");

    if (!db.users[chatId]?.language) {
      sessions[chatId] = { step: "language" };
      await askLanguage(chatId);
      return;
    }

    if (!db.users[chatId]?.agreedAt) {
      await showWelcome(chatId);
      return;
    }

    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }

  if (!db.users[chatId]?.language) {
    await askLanguage(chatId);
    return;
  }
  if (text === "/cancel") {
    sessions[chatId] = { step: "menu" };
    await sendTelegram(chatId, t(chatId, "cancel"));
    await showMainMenu(chatId);
    return;
  }

  if (text === "/menu") {
    sessions[chatId] = { step: "menu" };
    await showMainMenu(chatId);
    return;
  }

  if (text === "/account") {
    await handleCallback({
      id: "internal",
      message: { chat: { id: chatId } },
      data: "account"
    });
    return;
  }

  if (text === "/end") {
    const session = sessions[chatId];
    if (session?.step === "negotiation") {
      const negotiation = db.negotiations.find(
        n => n.id === session.negotiationId
      );
      if (negotiation) negotiation.status = "closed";
      saveDb();
      sessions[chatId] = { step: "menu" };
      await sendTelegram(chatId, "❌ تم إنهاء التفاوض.");
      await showMainMenu(chatId);
      return;
    }
  }

  const session = sessions[chatId];

  if (session?.step === "buy_product") {
    if (!text) return;
    session.product = text;
    session.step = "buy_max_price";
    await sendTelegram(chatId, t(chatId, "chooseMax"));
    return;
  }

  if (session?.step === "buy_max_price") {
    const price = parsePrice(text);
    if (!price) {
      await sendTelegram(chatId, t(chatId, "chooseMax"));
      return;
    }
    session.maxPrice = price;
    session.step = "buy_region";
    await sendTelegram(chatId, t(chatId, "chooseRegion"));
    return;
  }

  if (session?.step === "buy_region") {
    if (!text) return;
    session.region = text;
    session.step = "buy_results";
    logActivity(chatId, "buy_search", {
      product: session.product,
      maxPrice: session.maxPrice,
      region: session.region
    });

    await notifyAdmin(
      `🔎 بحث شراء جديد\n\n` +
      `🛒 المنتج: ${session.product}\n` +
      `💰 الحد الأقصى: ${formatPrice(session.maxPrice)}\n` +
      `📍 المنطقة: ${session.region}\n` +
      `👤 المستخدم: ${chatId}`
    );

    await sendTelegram(
      chatId,
      t(chatId, "searching") +
      `\n\n🛒 ${session.product}\n💰 ${formatPrice(session.maxPrice)}\n📍 ${session.region}`
    );

    const results = searchListings(
      session.product,
      session.maxPrice,
      session.region
    );

    await sendMarketplaceResults(chatId, session, results);
    return;
  }
    logActivity(chatId, "buy_search", {
      product: session.product,
      maxPrice: session.maxPrice,
      region: session.region
    });

    await notifyAdmin(
      `🔎 بحث شراء جديد\n\n` +
      `🛒 المنتج: ${session.product}\n` +
      `💰 الحد الأقصى: ${formatPrice(session.maxPrice)}\n` +
      `📍 المنطقة: ${session.region}\n` +
      `👤 المستخدم: ${chatId}`
    );

    await sendTelegram(
      chatId,
      t(chatId, "searching") +
      `\n\n🛒 ${session.product}\n💰 ${formatPrice(session.maxPrice)}\n📍 ${session.region}`
    );

    const results = searchListings(
      session.product,
      session.maxPrice,
      session.region
    );

    await sendMarketplaceResults(chatId, session, results);
    return;
  }
  if (session?.step === "sell_product") {
    if (!text) return;
    session.product = text;
    session.step = "sell_description";
    await sendTelegram(chatId, t(chatId, "sellDescription"));
    return;
  }

  if (session?.step === "sell_description") {
    if (!text) return;
    session.description = text;
    session.step = "sell_price";
    await sendTelegram(chatId, t(chatId, "sellPrice"));
    return;
  }
  if (session?.step === "sell_price") {
    const price = parsePrice(text);
    if (!price) {
      await sendTelegram(chatId, t(chatId, "sellPrice"));
      return;
    }
    session.price = price;
    session.step = "sell_region";
    await sendTelegram(chatId, t(chatId, "sellRegion"));
    return;
  }

  if (session?.step === "sell_region") {
    if (!text) return;
    session.region = text;
    session.step = "sell_photos";
    await sendTelegram(chatId, t(chatId, "photoRequired"), {
      inline_keyboard: [[
        { text: t(chatId, "done"), callback_data: "done_photos" }
      ]]
    });
    return;
  }
  if (session?.step === "negotiation") {
    if (text && await forwardNegotiationMessage(chatId, text)) {
      return;
    }
  }

  if (session?.step === "offer_price") {
    const price = parsePrice(text);
    if (!price) {
      await sendTelegram(chatId, "❌ السعر غير صحيح. أرسل رقمًا.");
      return;
    }

    session.proposedPrice = price;

    const negotiation = db.negotiations.find(
      n => n.id === session.negotiationId && n.status === "active"
    );

    if (!negotiation) {
      await sendTelegram(chatId, "❌ التفاوض غير متاح.");
      return;
    }

    const other =
      String(negotiation.buyerChatId) === String(chatId)
        ? negotiation.sellerChatId
        : negotiation.buyerChatId;

    sessions[other] = {
      step: "negotiation",
      negotiationId: negotiation.id,
      proposedPrice: price
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
              callback_data: `contact_${negotiation.listingId}`
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

  await sendTelegram(chatId, "ℹ️ استخدم /start للبدء من جديد.");
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

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(`
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        >
      </head>
      <body>
        <h1>🛍️ Telegram Marketplace</h1>
        <p>الخدمة تعمل بنجاح.</p>
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

        res.writeHead(200, {
          "Content-Type": "text/plain"
        });

        res.end("OK");

        handleWebhook(body).catch(error => {
          console.error("Webhook processing error:", error);
        });
      } catch (error) {
        console.error("Webhook JSON error:", error);

        res.writeHead(400, {
          "Content-Type": "text/plain"
        });

        res.end("Bad Request");
      }
    });

    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

if (!TELEGRAM_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not configured");
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Telegram Marketplace server running on port ${PORT}`
  );
});