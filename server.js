const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "";

const sessions = {};

const DB_FILE = path.join(__dirname, "marketplace-data.json");

// ============================================================
// DATABASE
// ============================================================

const DEFAULT_DB = {
  users: {},
  listings: [],
  buyRequests: [],
  negotiations: [],
  deals: [],
  activities: [],

  counters: {
    listing: 1,
    buyRequest: 1,
    negotiation: 1,
    deal: 1,
    activity: 1
  }
};

let db = loadDb();

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(DEFAULT_DB, null, 2),
        "utf8"
      );
      return JSON.parse(JSON.stringify(DEFAULT_DB));
    }

    const raw = fs.readFileSync(DB_FILE, "utf8");

    if (!raw.trim()) {
      return JSON.parse(JSON.stringify(DEFAULT_DB));
    }

    const saved = JSON.parse(raw);

    return {
      ...DEFAULT_DB,
      ...saved,

      users: saved.users || {},
      listings: Array.isArray(saved.listings)
        ? saved.listings
        : [],
      buyRequests: Array.isArray(saved.buyRequests)
        ? saved.buyRequests
        : [],
      negotiations: Array.isArray(saved.negotiations)
        ? saved.negotiations
        : [],
      deals: Array.isArray(saved.deals)
        ? saved.deals
        : [],
      activities: Array.isArray(saved.activities)
        ? saved.activities
        : [],

      counters: {
        ...DEFAULT_DB.counters,
        ...(saved.counters || {})
      }
    };
  } catch (error) {
    console.error("Database load error:", error);

    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function saveDb() {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Database save error:", error);
  }
}

// ============================================================
// TRANSLATIONS
// ============================================================

const TEXT = {
  ar: {
    lang:
      "🌐 اختر اللغة / Choose language / Оберіть мову",

    welcome:
      "🛍️ مرحباً بك في سوق تيليجرام\n\n" +
      "سوق خاص للبيع والشراء والتفاوض وإتمام الصفقات.\n\n" +
      "🔒 خصوصية المستخدمين محفوظة.\n\n" +
      "💰 عمولة المنصة: 5%\n" +
      "2.5% على المشتري + 2.5% على البائع\n\n" +
      "للدخول إلى السوق اضغط على الزر أدناه.",

    agree: "✅ أوافق وأدخل السوق",

    mainMenu: "🛍️ سوق تيليجرام\n\nاختر ما تريد:",

    buy: "🛒 شراء",
    sell: "📦 بيع",
    browse: "🔎 تصفح السوق",
    account: "👤 حسابي",

    back: "🔙 رجوع",
    cancel: "❌ إلغاء",

    chooseProduct:
      "🛒 ما المنتج الذي تبحث عنه؟\n\nأرسل اسم المنتج.",

    chooseMaxPrice:
      "💰 ما أقصى سعر تريد دفعه؟\n\nأرسل السعر بالأرقام.",

    chooseRegion:
      "📍 ما المنطقة المطلوبة؟\n\nأرسل اسم المدينة أو المنطقة، أو اكتب: الكل",

    searchStarted:
      "🔎 بدأ البحث في السوق...\n\nسأعرض لك الإعلانات المناسبة.",

    noListings:
      "📭 لا توجد إعلانات متاحة حالياً.",

    browseTitle:
      "🛍️ الإعلانات المتاحة حالياً:",

    sellProduct:
      "📦 ما المنتج الذي تريد بيعه؟\n\nأرسل اسم المنتج.",

    sellPrice:
      "💰 ما سعر البيع المطلوب؟\n\nأرسل السعر بالأرقام.",

    sellRegion:
      "📍 في أي منطقة يوجد المنتج؟\n\nأرسل اسم المدينة أو المنطقة.",

    photoRequired:
      "📸 أرسل صورة واحدة على الأقل للمنتج.\n\nيمكنك إرسال عدة صور، وبعد الانتهاء اضغط «تم».",

    done:
      "✅ تم",

    morePhotos:
      "📸 يمكنك إرسال صورة أخرى أو الضغط على «تم».",

    listingPublished:
      "✅ تم نشر إعلانك بنجاح في السوق.",

    error:
      "❌ حدث خطأ. حاول مرة أخرى.",

    invalidPrice:
      "❌ السعر غير صحيح.\n\nأرسل رقماً صحيحاً.",

    accountText:
      "👤 حسابي\n\n",

    dealOffer:
      "هل توافق على هذا السعر لإتمام الصفقة؟",

    dealCreated:
      "🤝 تم إنشاء الصفقة بنجاح.",

    offerSent:
      "📨 تم إرسال عرض السعر للطرف الآخر.",

    offerPrice:
      "💰 أرسل السعر الذي تقترحه لإتمام الصفقة.",

    negotiationStarted:
      "💬 بدأ التفاوض.\n\nأرسل رسالتك للطرف الآخر.",

    negotiationUnavailable:
      "❌ التفاوض غير متاح حالياً.",

    messageFromOther:
      "💬 رسالة من الطرف الآخر:\n\n",

    commissionInfo:
      "💰 عمولة المنصة: 5%\n" +
      "2.5% على المشتري + 2.5% على البائع",

    listingPrice:
      "💰 السعر:",

    listingRegion:
      "📍 المنطقة:",

    seller:
      "👤 البائع:",

    contactSeller:
      "💬 تفاوض مع البائع",

    makeOffer:
      "💰 تقديم عرض سعر",

    accountListings:
      "📦 إعلاناتي",

    accountRequests:
      "🛒 طلبات الشراء",

    accountDeals:
      "🤝 صفقاتي",

    emptyAccount:
      "لا توجد بيانات حتى الآن."
  },

  uk: {
    lang:
      "🌐 اختر اللغة / Choose language / Оберіть мову",

    welcome:
      "🛍️ Вітаємо на ринку Telegram\n\n" +
      "Приватний ринок для продажу, купівлі, переговорів та укладання угод.\n\n" +
      "🔒 Конфіденційність користувачів збережена.\n\n" +
      "💰 Комісія платформи: 5%\n" +
      "2.5% з покупця + 2.5% з продавця\n\n" +
      "Щоб увійти на ринок, натисніть кнопку нижче.",

    agree: "✅ Погоджуюсь і входжу",

    mainMenu: "🛍️ Ринок Telegram\n\nОберіть дію:",

    buy: "🛒 Купити",
    sell: "📦 Продати",
    browse: "🔎 Переглянути ринок",
    account: "👤 Мій акаунт",

    back: "🔙 Назад",
    cancel: "❌ Скасувати",

    chooseProduct:
      "🛒 Який товар ви шукаєте?\n\nНадішліть назву товару.",

    chooseMaxPrice:
      "💰 Яка максимальна ціна?\n\nНадішліть ціну цифрами.",

    chooseRegion:
      "📍 Який регіон потрібен?\n\nНадішліть місто або область або напишіть: будь-яка",

    searchStarted:
      "🔎 Пошук розпочато...\n\nПоказую відповідні оголошення.",

    noListings:
      "📭 Наразі немає доступних оголошень.",

    browseTitle:
      "🛍️ Доступні оголошення:",

    sellProduct:
      "📦 Який товар ви хочете продати?\n\nНадішліть назву товару.",

    sellPrice:
      "💰 Яка бажана ціна продажу?\n\nНадішліть ціну цифрами.",

    sellRegion:
      "📍 У якому регіоні знаходиться товар?\n\nНадішліть місто або область.",

    photoRequired:
      "📸 Надішліть хоча б одну фотографію товару.\n\nПісля завершення натисніть «Готово».",

    done:
      "✅ Готово",

    morePhotos:
      "📸 Можете надіслати ще фото або натиснути «Готово».",

    listingPublished:
      "✅ Ваше оголошення успішно опубліковано.",

    error:
      "❌ Сталася помилка. Спробуйте ще раз.",

    invalidPrice:
      "❌ Неправильна ціна.\n\nНадішліть число.",

    accountText:
      "👤 Мій акаунт\n\n",

    dealOffer:
      "Погоджуєтесь із цією ціною для укладання угоди?",

    dealCreated:
      "🤝 Угоду успішно створено.",

    offerSent:
      "📨 Пропозицію ціни надіслано іншій стороні.",

    offerPrice:
      "💰 Надішліть ціну, яку пропонуєте.",

    negotiationStarted:
      "💬 Переговори розпочато.\n\nНадішліть повідомлення іншій стороні.",

    negotiationUnavailable:
      "❌ Переговори зараз недоступні.",

    messageFromOther:
      "💬 Повідомлення від іншої сторони:\n\n",

    commissionInfo:
      "💰 Комісія платформи: 5%\n" +
      "2.5% з покупця + 2.5% з продавця",

    listingPrice:
      "💰 Ціна:",

    listingRegion:
      "📍 Регіон:",

    seller:
      "👤 Продавець:",

    contactSeller:
      "💬 Переговори з продавцем",

    makeOffer:
      "💰 Запропонувати ціну",

    accountListings:
      "📦 Мої оголошення",

    accountRequests:
      "🛒 Мої запити",

    accountDeals:
      "🤝 Мої угоди",

    emptyAccount:
      "Поки що немає даних."
  },

  en: {
    lang:
      "🌐 اختر اللغة / Choose language / Оберіть мову",

    welcome:
      "🛍️ Welcome to Telegram Marketplace\n\n" +
      "A private marketplace for buying, selling, negotiating and completing deals.\n\n" +
      "🔒 User privacy is protected.\n\n" +
      "💰 Platform commission: 5%\n" +
      "2.5% buyer + 2.5% seller\n\n" +
      "To enter the marketplace, press the button below.",

// ============================================================
// LISTING / BUY REQUEST / NEGOTIATION HELPERS
// ============================================================

function createListing(chatId, data) {
  const id = db.counters.listing++;

  const seller = db.users[String(chatId)] || {};

  const listing = {
    id,

    sellerChatId: String(chatId),

    sellerName: userDisplay(seller),

    product: String(data.product || "").trim(),

    price: Number(data.price),

    region: String(data.region || "").trim(),

    photos: Array.isArray(data.photos)
      ? [...data.photos]
      : [],

    status: "active",

    createdAt: now(),

    updatedAt: now()
  };

  db.listings.push(listing);

  saveDb();

  return listing;
}

function createBuyRequest(chatId, data) {
  const id = db.counters.buyRequest++;

  const request = {
    id,

    buyerChatId: String(chatId),

    product: String(data.product || "").trim(),

    maxPrice: Number(data.maxPrice),

    region: String(data.region || "").trim(),

    status: "active",

    createdAt: now(),

    updatedAt: now()
  };

  db.buyRequests.push(request);

  saveDb();

  return request;
}

function findListing(listingId) {
  return db.listings.find(
    listing =>
      Number(listing.id) === Number(listingId)
  );
}

function findNegotiation(negotiationId) {
  return db.negotiations.find(
    negotiation =>
      Number(negotiation.id) === Number(negotiationId)
  );
}

function findActiveNegotiation(
  buyerChatId,
  sellerChatId,
  listingId
) {
  return db.negotiations.find(
    negotiation =>
      negotiation.status === "active" &&
      sameId(negotiation.buyerChatId, buyerChatId) &&
      sameId(negotiation.sellerChatId, sellerChatId) &&
      Number(negotiation.listingId) === Number(listingId)
  );
}

// ============================================================
// SEARCH
// ============================================================

function searchListings(
  product,
  maxPrice = null,
  region = ""
) {
  const wantedProduct =
    normalizeText(product);

  const wantedRegion =
    normalizeText(region);

  return db.listings
    .filter(listing => {
      if (listing.status !== "active") {
        return false;
      }

      const listingProduct =
        normalizeText(listing.product);

      const listingRegion =
        normalizeText(listing.region);

      if (
        wantedProduct &&
        !listingProduct.includes(wantedProduct) &&
        !wantedProduct.includes(listingProduct)
      ) {
        return false;
      }

      if (
        maxPrice !== null &&
        Number(listing.price) > Number(maxPrice)
      ) {
        return false;
      }

      if (
        wantedRegion &&
        wantedRegion !== "الكل" &&
        wantedRegion !== "أي" &&
        wantedRegion !== "any" &&
        wantedRegion !== "будь-яка"
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
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );
}

// ============================================================
// NEGOTIATION
// ============================================================

function createNegotiation(
  buyerChatId,
  sellerChatId,
  listingId
) {
  const existing =
    findActiveNegotiation(
      buyerChatId,
      sellerChatId,
      listingId
    );

  if (existing) {
    return existing;
  }

  const id = db.counters.negotiation++;

  const negotiation = {
    id,

    listingId: Number(listingId),

    buyerChatId: String(buyerChatId),

    sellerChatId: String(sellerChatId),

    status: "active",

    messages: [],

    offers: [],

    createdAt: now(),

    updatedAt: now()
  };

  db.negotiations.push(negotiation);

  saveDb();

  return negotiation;
}

function addNegotiationMessage(
  negotiation,
  fromChatId,
  text
) {
  if (!Array.isArray(negotiation.messages)) {
    negotiation.messages = [];
  }

  negotiation.messages.push({
    fromChatId: String(fromChatId),

    text: String(text),

    createdAt: now()
  });

  negotiation.updatedAt = now();

  saveDb();
}

function addNegotiationOffer(
  negotiation,
  fromChatId,
  price
) {
  if (!Array.isArray(negotiation.offers)) {
    negotiation.offers = [];
  }

  const offer = {
    fromChatId: String(fromChatId),

    price: Number(price),

    createdAt: now()
  };

  negotiation.offers.push(offer);

  negotiation.updatedAt = now();

  saveDb();

  return offer;
}

// ============================================================
// DEAL
// ============================================================

async function createDeal(
  negotiation,
  finalPrice
) {
  const price = Number(finalPrice);

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }

  const buyerCommission =
    Math.round(price * 0.025 * 100) / 100;

  const sellerCommission =
    Math.round(price * 0.025 * 100) / 100;

  const totalCommission =
    Math.round(
      (buyerCommission + sellerCommission) * 100
    ) / 100;

  const id = db.counters.deal++;

  const deal = {
    id,

    negotiationId: Number(negotiation.id),

    listingId: Number(negotiation.listingId),

    buyerChatId:
      String(negotiation.buyerChatId),

    sellerChatId:
      String(negotiation.sellerChatId),

    price,

    buyerCommission,

    sellerCommission,

    totalCommission,

    status: "agreed",

    createdAt: now(),

    updatedAt: now()
  };

  db.deals.push(deal);

  negotiation.status = "deal_created";

  negotiation.finalPrice = price;

  negotiation.updatedAt = now();

  const listing =
    findListing(negotiation.listingId);

  if (listing) {
    listing.status = "sold";
    listing.updatedAt = now();
  }

  saveDb();

  logActivity(
    negotiation.buyerChatId,
    "deal_created",
    {
      dealId: deal.id,
      negotiationId: negotiation.id
    }
  );

  logActivity(
    negotiation.sellerChatId,
    "deal_created",
    {
      dealId: deal.id,
      negotiationId: negotiation.id
    }
  );

  const buyerText =
    "🤝 تم الاتفاق على الصفقة.\n\n" +
    `💰 السعر: ${formatPrice(price)}\n` +
    `💰 عمولة المشتري 2.5%: ${formatPrice(buyerCommission)}\n\n` +
    `${t(negotiation.buyerChatId, "commissionInfo")}`;

  const sellerText =
    "🤝 تم الاتفاق على الصفقة.\n\n" +
    `💰 السعر: ${formatPrice(price)}\n` +
    `💰 عمولة البائع 2.5%: ${formatPrice(sellerCommission)}\n\n` +
    `${t(negotiation.sellerChatId, "commissionInfo")}`;

  await sendTelegram(
    negotiation.buyerChatId,
    buyerText
  );

  await sendTelegram(
    negotiation.sellerChatId,
    sellerText
  );

  await notifyAdmin(
    "🤝 صفقة جديدة\n\n" +
    `🆔 الصفقة: #${deal.id}\n` +
    `🆔 الإعلان: #${deal.listingId}\n` +
    `💰 السعر: ${formatPrice(price)}\n` +
    `💰 عمولة المشتري: ${formatPrice(buyerCommission)}\n` +
    `💰 عمولة البائع: ${formatPrice(sellerCommission)}\n` +
    `💰 إجمالي العمولة: ${formatPrice(totalCommission)}`
  );

  return deal;
}

// ============================================================
// FORWARD NEGOTIATION MESSAGE
// ============================================================

async function forwardNegotiationMessage(
  chatId,
  text
) {
  const session =
    sessions[String(chatId)];

  const negotiation =
    findNegotiation(
      session?.negotiationId
    );

  if (
    !negotiation ||
    negotiation.status !== "active"
  ) {
    return false;
  }

  const senderIsBuyer =
    sameId(
      negotiation.buyerChatId,
      chatId
    );

  const senderIsSeller =
    sameId(
      negotiation.sellerChatId,
      chatId
    );

  if (!senderIsBuyer && !senderIsSeller) {
    return false;
  }

  const receiver =
    senderIsBuyer
      ? negotiation.sellerChatId
      : negotiation.buyerChatId;

  addNegotiationMessage(
    negotiation,
    chatId,
    text
  );

  await sendTelegram(
    receiver,
    t(receiver, "messageFromOther") +
    String(text)
  );

  await notifyAdmin(
    "💬 رسالة تفاوض\n\n" +
    `🆔 التفاوض: #${negotiation.id}\n` +
    `👤 من: ${chatId}\n` +
    `👤 إلى: ${receiver}`
  );

  return true;
}

// ============================================================
// LISTING DISPLAY
// ============================================================

function listingText(
  chatId,
  listing
) {
  return (
    `🛍️ ${listing.product}\n\n` +
    `${t(chatId, "listingPrice")} ` +
    `${formatPrice(listing.price)}\n` +
    `${t(chatId, "listingRegion")} ` +
    `${listing.region}\n` +
    `${t(chatId, "seller")} ` +
    `${listing.sellerName || "غير معروف"}`
  );
}

async function sendListing(
  chatId,
  listing,
  viewerChatId = chatId
) {
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: t(
            viewerChatId,
            "contactSeller"
          ),
          callback_data:
            `contact_${listing.id}`
        }
      ],
      [
        {
          text: t(
            viewerChatId,
            "makeOffer"
          ),
          callback_data:
            `offer_${listing.id}`
        }
      ]
    ]
  };

  const caption =
    listingText(
      viewerChatId,
      listing
    );

  if (
    Array.isArray(listing.photos) &&
    listing.photos.length > 0
  ) {
    await sendPhoto(
      chatId,
      listing.photos[0],
      caption,
      keyboard
    );

    return;
  }

  await sendTelegram(
    chatId,
    caption,
    keyboard
  );
}

// ============================================================
// BROWSE MARKETPLACE
// ============================================================

async function showBrowse(chatId) {
  logActivity(
    chatId,
    "browse_marketplace"
  );

  const listings =
    db.listings
      .filter(
        listing =>
          listing.status === "active"
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .slice(0, 20);

  if (!listings.length) {
    await sendTelegram(
      chatId,
      t(chatId, "noListings"),
      backKeyboard(chatId)
    );

    return;
  }

  await sendTelegram(
    chatId,
    t(chatId, "browseTitle")
  );

  for (const listing of listings) {
    await sendListing(
      chatId,
      listing,
      chatId
    );
  }
}

// ============================================================
// SEARCH RESULTS
// ============================================================

async function showSearchResults(
  chatId,
  results
) {
  if (!results.length) {
    await sendTelegram(
      chatId,
      t(chatId, "noListings"),
      backKeyboard(chatId)
    );

    return;
  }

  await sendTelegram(
    chatId,
    t(chatId, "browseTitle")
  );

  for (const listing of results) {
    await sendListing(
      chatId,
      listing,
      chatId
    );
  }
}

// ============================================================
// SELL PHOTO KEYBOARD
// ============================================================

function photoDoneKeyboard(chatId) {
  return {
    inline_keyboard: [
      [
        {
          text: t(chatId, "done"),
          callback_data: "done_photos"
        }
      ],
      [
        {
          text: t(chatId, "cancel"),
          callback_data: "cancel"
        }
      ]
    ]
  };
}

// ============================================================
// ACCOUNT
// ============================================================

async function showAccount(chatId) {
  const id = String(chatId);

  const mine =
    db.listings.filter(
      listing =>
        sameId(
          listing.sellerChatId,
          id
        )
    );

  const requests =
    db.buyRequests.filter(
      request =>
        sameId(
          request.buyerChatId,
          id
        )
    );

  const deals =
    db.deals.filter(
      deal =>
        sameId(
          deal.buyerChatId,
          id
        ) ||
        sameId(
          deal.sellerChatId,
          id
        )
    );

  const text =
    t(chatId, "accountText") +
    `📦 ${mine.length}\n` +
    `🛒 ${requests.length}\n` +
    `🤝 ${deals.length}`;

  await sendTelegram(
    chatId,
    text,
    accountKeyboard(chatId)
  );
}

// ============================================================
// ACCOUNT LISTINGS
// ============================================================

async function showMyListings(chatId) {
  const listings =
    db.listings.filter(
      listing =>
        sameId(
          listing.sellerChatId,
          chatId
        )
    );

  if (!listings.length) {
    await sendTelegram(
      chatId,
      t(chatId, "emptyAccount"),
      backKeyboard(chatId)
    );

    return;
  }

  for (const listing of listings) {
    await sendListing(
      chatId,
      listing,
      chatId
    );
  }

  await sendTelegram(
    chatId,
    t(chatId, "back"),
    backKeyboard(chatId)
  );
}

// ============================================================
// ACCOUNT BUY REQUESTS
// ============================================================

async function showMyRequests(chatId) {
  const requests =
    db.buyRequests.filter(
      request =>
        sameId(
          request.buyerChatId,
          chatId
        )
    );

  if (!requests.length) {
    await sendTelegram(
      chatId,
      t(chatId, "emptyAccount"),
      backKeyboard(chatId)
    );

    return;
  }

  for (const request of requests) {
    await sendTelegram(
      chatId,

      "🛒 طلب شراء\n\n" +
      `📦 ${request.product}\n` +
      `💰 الحد الأقصى: ${formatPrice(request.maxPrice)}\n` +
      `📍 ${request.region}\n` +
      `📌 الحالة: ${request.status}`
    );
  }

  await sendTelegram(
    chatId,
    t(chatId, "back"),
    backKeyboard(chatId)
  );
}

// ============================================================
// ACCOUNT DEALS
// ============================================================

async function showMyDeals(chatId) {
  const deals =
    db.deals.filter(
      deal =>
        sameId(
          deal.buyerChatId,
          chatId
        ) ||
        sameId(
          deal.sellerChatId,
          chatId
        )
    );

  if (!deals.length) {
    await sendTelegram(
      chatId,
      t(chatId, "emptyAccount"),
      backKeyboard(chatId)
    );

    return;
  }

  for (const deal of deals) {
    const role =
      sameId(
        deal.buyerChatId,
        chatId
      )
        ? "🛒 مشتري"
        : "📦 بائع";

    await sendTelegram(
      chatId,

      "🤝 صفقة\n\n" +
      `🆔 #${deal.id}\n` +
      `${role}\n` +
      `💰 السعر: ${formatPrice(deal.price)}\n` +
      `💰 عمولتك: ` +
      `${
        sameId(
          deal.buyerChatId,
          chatId
        )
          ? formatPrice(
              deal.buyerCommission
            )
          : formatPrice(
              deal.sellerCommission
            )
      }\n` +
      `📌 الحالة: ${deal.status}`
    );
  }

  await sendTelegram(
    chatId,
    t(chatId, "back"),
    backKeyboard(chatId)
  );
}

// ============================================================
// WELCOME / MAIN MENU
// ============================================================

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
  sessions[String(chatId)] = {
    step: "menu"
  };

  await sendTelegram(
    chatId,
    t(chatId, "mainMenu"),
    mainMenuKeyboard(chatId)
  );
}

// ============================================================
// PROFILE UPDATE
// ============================================================

function updateUserFromTelegram(message) {
  if (!message?.from) {
    return;
  }

  const chatId = String(message.chat.id);

  setUser(chatId, {
    firstName: message.from.first_name || "",
    lastName: message.from.last_name || "",
    username: message.from.username || ""
  });
}

// ============================================================
// CANCEL
// ============================================================

async function cancelSession(chatId) {
  delete sessions[String(chatId)];

  await sendTelegram(
    chatId,
    t(chatId, "mainMenu"),
    mainMenuKeyboard(chatId)
  );
}

// ============================================================
// START NEGOTIATION
// ============================================================

async function startNegotiation(
  buyerChatId,
  listingId
) {
  const listing = findListing(listingId);

  if (!listing) {
    await sendTelegram(
      buyerChatId,
      t(buyerChatId, "error")
    );

    return null;
  }

  if (listing.status !== "active") {
    await sendTelegram(
      buyerChatId,
      "❌ هذا الإعلان لم يعد متاحاً."
    );

    return null;
  }

  if (
    sameId(
      listing.sellerChatId,
      buyerChatId
    )
  ) {
    await sendTelegram(
      buyerChatId,
      "❌ لا يمكنك التفاوض على إعلانك الخاص."
    );

    return null;
  }

  const negotiation =
    createNegotiation(
      buyerChatId,
      listing.sellerChatId,
      listing.id
    );

  sessions[String(buyerChatId)] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  sessions[String(listing.sellerChatId)] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  await sendTelegram(
    buyerChatId,
    t(buyerChatId, "negotiationStarted")
  );

  await sendTelegram(
    listing.sellerChatId,
    "💬 هناك مشتري يريد التفاوض على إعلانك.\n\n" +
    `📦 المنتج: ${listing.product}\n` +
    `💰 السعر المطلوب: ${formatPrice(listing.price)}\n\n` +
    t(
      listing.sellerChatId,
      "negotiationStarted"
    )
  );

  await notifyAdmin(
    "💬 بدء تفاوض جديد\n\n" +
    `🆔 التفاوض: #${negotiation.id}\n` +
    `🆔 الإعلان: #${listing.id}\n` +
    `👤 المشتري: ${buyerChatId}\n` +
    `👤 البائع: ${listing.sellerChatId}`
  );

  return negotiation;
}

// ============================================================
// START PRICE OFFER
// ============================================================

async function startPriceOffer(
  buyerChatId,
  listingId
) {
  const listing = findListing(listingId);

  if (!listing) {
    await sendTelegram(
      buyerChatId,
      t(buyerChatId, "error")
    );

    return null;
  }

  if (listing.status !== "active") {
    await sendTelegram(
      buyerChatId,
      "❌ هذا الإعلان لم يعد متاحاً."
    );

    return null;
  }

  if (
    sameId(
      listing.sellerChatId,
      buyerChatId
    )
  ) {
    await sendTelegram(
      buyerChatId,
      "❌ لا يمكنك تقديم عرض على إعلانك الخاص."
    );

    return null;
  }

  const negotiation =
    createNegotiation(
      buyerChatId,
      listing.sellerChatId,
      listing.id
    );

  sessions[String(buyerChatId)] = {
    step: "offer_price",
    negotiationId: negotiation.id
  };

  sessions[String(listing.sellerChatId)] = {
    step: "negotiation",
    negotiationId: negotiation.id
  };

  await sendTelegram(
    buyerChatId,
    t(buyerChatId, "offerPrice")
  );

  return negotiation;
}

// ============================================================
// HANDLE CALLBACK QUERY
// ============================================================

async function handleCallback(query) {
  try {
    await answerCallback(query.id);

    if (!query.message) {
      return;
    }

    const chatId =
      String(query.message.chat.id);

    const data =
      String(query.data || "");

    updateUserFromTelegram(
      query.message
    );

    // ========================================================
    // LANGUAGE
    // ========================================================

    if (data.startsWith("lang_")) {
      const language =
        data.slice(5);

      if (!TEXT[language]) {
        return;
      }

      setUser(chatId, {
        language
      });

      logActivity(
        chatId,
        "language_selected",
        { language }
      );

      await showWelcome(chatId);

      return;
    }

    // ========================================================
    // AGREEMENT
    // ========================================================

    if (data === "agree") {
      setUser(chatId, {
        agreedAt: now()
      });

      logActivity(
        chatId,
        "entered_marketplace"
      );

      await showMainMenu(chatId);

      return;
    }

    // ========================================================
    // LANGUAGE GUARD
    // ========================================================

    if (!db.users[chatId]?.language) {
      await askLanguage(chatId);
      return;
    }

    // ========================================================
    // MENU
    // ========================================================

    if (data === "menu") {
      await showMainMenu(chatId);
      return;
    }

    // ========================================================
    // CANCEL
    // ========================================================

    if (data === "cancel") {
      await cancelSession(chatId);
      return;
    }

    // ========================================================
    // BUY
    // ========================================================

    if (data === "buy") {
      sessions[chatId] = {
        step: "buy_product"
      };

      logActivity(
        chatId,
        "start_buy"
      );

      await sendTelegram(
        chatId,
        t(chatId, "chooseProduct")
      );

      return;
    }

    // ========================================================
    // SELL
    // ========================================================

    if (data === "sell") {
      sessions[chatId] = {
        step: "sell_product",
        photos: []
      };

      logActivity(
        chatId,
        "start_sell"
      );

      await sendTelegram(
        chatId,
        t(chatId, "sellProduct")
      );

      return;
    }

    // ========================================================
    // BROWSE
    // ========================================================

    if (data === "browse") {
      sessions[chatId] = {
        step: "menu"
      };

      await showBrowse(chatId);

      return;
    }

    // ========================================================
    // ACCOUNT
    // ========================================================

    if (data === "account") {
      await showAccount(chatId);
      return;
    }

    // ========================================================
    // ACCOUNT LISTINGS
    // ========================================================

    if (data === "account_listings") {
      await showMyListings(chatId);
      return;
    }

    // ========================================================
    // ACCOUNT REQUESTS
    // ========================================================

    if (data === "account_requests") {
      await showMyRequests(chatId);
      return;
    }

    // ========================================================
    // ACCOUNT DEALS
    // ========================================================

    if (data === "account_deals") {
      await showMyDeals(chatId);
      return;
    }

    // ========================================================
    // CONTACT SELLER
    // ========================================================

    if (data.startsWith("contact_")) {
      const listingId =
        Number(data.slice(8));

      await startNegotiation(
        chatId,
        listingId
      );

      return;
    }

    // ========================================================
    // MAKE OFFER
    // ========================================================

    if (data.startsWith("offer_")) {
      const listingId =
        Number(data.slice(6));

      await startPriceOffer(
        chatId,
        listingId
      );

      return;
    }

    // ========================================================
    // DONE PHOTOS
    // ========================================================

    if (data === "done_photos") {
      const session =
        sessions[chatId];

      if (
        !session ||
        session.step !== "sell_photos"
      ) {
        await sendTelegram(
          chatId,
          t(chatId, "error")
        );

        return;
      }

      if (
        !Array.isArray(session.photos) ||
        session.photos.length === 0
      ) {
        await sendTelegram(
          chatId,
          t(chatId, "photoRequired")
        );

        return;
      }

      if (
        !session.product ||
        !session.price ||
        !session.region
      ) {
        await sendTelegram(
          chatId,
          t(chatId, "error")
        );

        return;
      }

      const listing =
        createListing(
          chatId,
          session
        );

      logActivity(
        chatId,
        "listing_published",
        {
          listingId: listing.id
        }
      );

      delete sessions[chatId];

      await sendTelegram(
        chatId,
        t(chatId, "listingPublished") +
        "\n\n" +
        `🆔 الإعلان: #${listing.id}\n` +
        `📦 ${listing.product}\n` +
        `💰 ${formatPrice(listing.price)}\n` +
        `📍 ${listing.region}`
      );

      await notifyAdmin(
        "📦 إعلان جديد\n\n" +
        `🆔 الإعلان: #${listing.id}\n` +
        `👤 البائع: ${chatId}\n` +
        `📦 المنتج: ${listing.product}\n` +
        `💰 السعر: ${formatPrice(listing.price)}\n` +
        `📍 المنطقة: ${listing.region}\n` +
        `📸 عدد الصور: ${listing.photos.length}`
      );

      await showMainMenu(chatId);

      return;
    }

    // ========================================================
    // DEAL APPROVE
    // ========================================================

    if (data.startsWith("deal_approve_")) {
      const negotiationId =
        Number(data.slice(13));

      const negotiation =
        findNegotiation(
          negotiationId
        );

      if (
        !negotiation ||
        negotiation.status !== "active"
      ) {
        await sendTelegram(
          chatId,
          t(chatId, "negotiationUnavailable")
        );

        return;
      }

      const isBuyer =
        sameId(
          negotiation.buyerChatId,
          chatId
        );

      const isSeller =
        sameId(
          negotiation.sellerChatId,
          chatId
        );

      if (!isBuyer && !isSeller) {
        return;
      }

      const session =
        sessions[chatId];

      let price =
        session?.proposedPrice || null;

      if (!price) {
        const offers =
          Array.isArray(
            negotiation.offers
          )
            ? negotiation.offers
            : [];

        for (
          let i = offers.length - 1;
          i >= 0;
          i--
        ) {
          if (
            !sameId(
              offers[i].fromChatId,
              chatId
            )
          ) {
            price =
              Number(offers[i].price);
            break;
          }
        }
      }

      if (
        !price ||
        !Number.isFinite(Number(price))
      ) {
        await sendTelegram(
          chatId,
          "❌ لا يوجد عرض سعر صالح للموافقة."
        );

        return;
      }

      const deal =
        await createDeal(
          negotiation,
          price
        );

      if (!deal) {
        await sendTelegram(
          chatId,
          t(chatId, "error")
        );

        return;
      }

      delete sessions[
        String(
          negotiation.buyerChatId
        )
      ];

      delete sessions[
        String(
          negotiation.sellerChatId
        )
      ];

      return;
    }

    // ========================================================
    // DEAL OFFER / NEGOTIATE
    // ========================================================

    if (data.startsWith("deal_offer_")) {
      const negotiationId =
        Number(data.slice(11));

      const negotiation =
        findNegotiation(
          negotiationId
        );

      if (
        !negotiation ||
        negotiation.status !== "active"
      ) {
        await sendTelegram(
          chatId,
          t(chatId, "negotiationUnavailable")
        );

        return;
      }

      const isBuyer =
        sameId(
          negotiation.buyerChatId,
          chatId
        );

      const isSeller =
        sameId(
          negotiation.sellerChatId,
          chatId
        );

      if (!isBuyer && !isSeller) {
        return;
      }

      sessions[chatId] = {
        step: "offer_price",
        negotiationId:
          negotiation.id
      };

      await sendTelegram(
        chatId,
        t(chatId, "offerPrice")
      );

      return;
    }
  } catch (error) {
    console.error(
      "Callback error:",
      error
    );
  }
}

// ============================================================
// HANDLE PHOTO
// ============================================================

async function handlePhoto(message) {
  const chatId =
    String(message.chat.id);

  updateUserFromTelegram(message);

  if (!db.users[chatId]?.language) {
    await askLanguage(chatId);
    return;
  }

  if (!db.users[chatId]?.agreedAt) {
    await showWelcome(chatId);
    return;
  }

  const session =
    sessions[chatId];

  if (
    !session ||
    session.step !== "sell_photos"
  ) {
    await sendTelegram(
      chatId,
      "📸 إذا كنت تريد إضافة إعلان، اختر «بيع» من القائمة."
    );

    return;
  }

  if (
    !Array.isArray(session.photos)
  ) {
    session.photos = [];
  }

  const photos =
    message.photo || [];

  if (!photos.length) {
    return;
  }

  const largestPhoto =
    photos[photos.length - 1];

  if (largestPhoto.file_id) {
    session.photos.push(
      largestPhoto.file_id
    );
  }

  await sendTelegram(
    chatId,
    t(chatId, "morePhotos"),
    photoDoneKeyboard(chatId)
  );
}

// ============================================================
// HANDLE TEXT MESSAGE
// ============================================================

async function handleMessage(message) {
  if (!message?.chat) {
    return;
  }

  const chatId =
    String(message.chat.id);

  updateUserFromTelegram(message);

  const text =
    typeof message.text === "string"
      ? message.text.trim()
      : "";

  // ==========================================================
  // START
  // ==========================================================

  if (text === "/start") {
    setUser(chatId);

    logActivity(
      chatId,
      "start"
    );

    if (!db.users[chatId]?.language) {
      sessions[chatId] = {
        step: "language"
      };

      await askLanguage(chatId);

      return;
    }

    if (!db.users[chatId]?.agreedAt) {
      await showWelcome(chatId);
      return;
    }

    await showMainMenu(chatId);

    return;
  }

  // ==========================================================
  // LANGUAGE FIRST
  // ==========================================================

  if (!db.users[chatId]?.language) {
    sessions[chatId] = {
      step: "language"
    };

    await askLanguage(chatId);

    return;
  }

  // ==========================================================
  // WELCOME AGREEMENT
  // ==========================================================

  if (!db.users[chatId]?.agreedAt) {
    await showWelcome(chatId);
    return;
  }

  // ==========================================================
  // EMPTY TEXT
  // ==========================================================

  if (!text) {
    return;
  }

  const session =
    sessions[chatId];

  // ==========================================================
  // BUY - PRODUCT
  // ==========================================================

  if (
    session?.step === "buy_product"
  ) {
    session.product = text;

    session.step =
      "buy_max_price";

    await sendTelegram(
      chatId,
      t(chatId, "chooseMaxPrice")
    );

    return;
  }

  // ==========================================================
  // BUY - MAX PRICE
  // ==========================================================

  if (
    session?.step === "buy_max_price"
  ) {
    const maxPrice =
      parsePrice(text);

    if (!maxPrice) {
      await sendTelegram(
        chatId,
        t(chatId, "invalidPrice")
      );

      return;
    }

    session.maxPrice =
      maxPrice;

    session.step =
      "buy_region";

    await sendTelegram(
      chatId,
      t(chatId, "chooseRegion")
    );

    return;
  }

  // ==========================================================
  // BUY - REGION
  // ==========================================================

  if (
    session?.step === "buy_region"
  ) {
    session.region = text;

    const request =
      createBuyRequest(
        chatId,
        session
      );

    logActivity(
      chatId,
      "buy_request_created",
      {
        buyRequestId:
          request.id
      }
    );

    await sendTelegram(
      chatId,
      t(chatId, "searchStarted")
    );

    const results =
      searchListings(
        session.product,
        session.maxPrice,
        session.region
      );

    delete sessions[chatId];

    await showSearchResults(
      chatId,
      results
    );

    await notifyAdmin(
      "🛒 طلب شراء جديد\n\n" +
      `🆔 الطلب: #${request.id}\n` +
      `👤 المشتري: ${chatId}\n` +
      `📦 المنتج: ${request.product}\n` +
      `💰 الحد الأقصى: ${formatPrice(request.maxPrice)}\n` +
      `📍 المنطقة: ${request.region}`
    );

    return;
  }

  // ==========================================================
  // SELL - PRODUCT
  // ==========================================================

  if (
    session?.step === "sell_product"
  ) {
    session.product = text;

    session.step =
      "sell_price";

    await sendTelegram(
      chatId,
      t(chatId, "sellPrice")
    );

    return;
  }

  // ==========================================================
  // SELL - PRICE
  // ==========================================================

  if (
    session?.step === "sell_price"
  ) {
    const price =
      parsePrice(text);

    if (!price) {
      await sendTelegram(
        chatId,
        t(chatId, "invalidPrice")
      );

      return;
    }

    session.price =
      price;

    session.step =
      "sell_region";

    await sendTelegram(
      chatId,
      t(chatId, "sellRegion")
    );

    return;
  }

  // ==========================================================
  // SELL - REGION
  // ==========================================================

  if (
    session?.step === "sell_region"
  ) {
    if (!text) {
      return;
    }

    session.region =
      text;

    session.step =
      "sell_photos";

    if (!Array.isArray(session.photos)) {
      session.photos = [];
    }

    await sendTelegram(
      chatId,
      t(chatId, "photoRequired"),
      photoDoneKeyboard(chatId)
    );

    return;
  }

  // ==========================================================
  // NEGOTIATION MESSAGES
  // ==========================================================

  if (
    session?.step === "negotiation"
  ) {
    const forwarded =
      await forwardNegotiationMessage(
        chatId,
        text
      );

    if (forwarded) {
      return;
    }
  }

  // ==========================================================
  // OFFER PRICE
  // ==============================
  if (session.step === "offer_price") {
    const price = parsePrice(text);

    if (!price) {
      await sendTelegram(
        token,
        chatId,
        "❌ الرجاء إدخال سعر صحيح."
      );
      return;
    }

    const negotiation = findNegotiation(session.negotiationId);

    if (!negotiation) {
      cancelSession(chatId);
      await sendTelegram(
        token,
        chatId,
        "❌ انتهت هذه المفاوضة أو لم تعد موجودة.",
        mainMenuKeyboard()
      );
      return;
    }

    await addNegotiationOffer(
      negotiation.id,
      chatId,
      price
    );

    const other =
      sameId(negotiation.buyerId, chatId)
        ? negotiation.sellerId
        : negotiation.buyerId;

    const lang = getLanguage(other);

    sessions[String(other)] = {
      step: "negotiation",
      negotiationId: negotiation.id,
      proposedPrice: price
    };

    await sendTelegram(
      token,
      other,
      "💰 تم إرسال عرض جديد.\n\n" +
      "السعر المقترح: " +
      formatPrice(price) +
      "\n\n" +
      "هل توافق على هذا السعر؟",
      {
        inline_keyboard: [
          [
            {
              text: t(lang, "approve"),
              callback_data: "deal_approve_" + negotiation.id
            },
            {
              text: t(lang, "newOffer"),
              callback_data: "deal_offer_" + negotiation.id
            }
          ],
          [
            {
              text: t(lang, "cancel"),
              callback_data: "cancel"
            }
          ]
        ]
      }
    );

    await sendTelegram(
      token,
      chatId,
      "✅ تم إرسال عرضك.\n\n" +
      "السعر المقترح: " +
      formatPrice(price) +
      "\n\n" +
      "بانتظار رد الطرف الآخر."
    );

    sessions[String(chatId)] = {
      step: "negotiation",
      negotiationId: negotiation.id
    };

    return;
  }

  // ==========================================================
  // DEFAULT
  // ==========================================================

  await sendTelegram(
    token,
    chatId,
    t(lang, "chooseAction"),
    mainMenuKeyboard(lang)
  );
}

// ============================================================
// WEBHOOK
// ============================================================

async function handleWebhook(update) {
  if (!update) return;

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return;
    }

    if (update.message) {
      const message = update.message;

      if (message.photo) {
        await handlePhoto(message);
        return;
      }

      if (message.text) {
        await handleMessage(message);
        return;
      }
    }
  } catch (error) {
    console.error("Webhook error:", error);

    const chatId =
      update.message?.chat?.id ||
      update.callback_query?.message?.chat?.id;

    if (chatId) {
      try {
        await sendTelegram(
          token,
          chatId,
          "❌ حدث خطأ غير متوقع. حاول مرة أخرى."
        );
      } catch (_) {}
    }
  }
}

// ============================================================
// HTTP SERVER
// ============================================================

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Telegram Marketplace is running successfully.");
    return;
  }

  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const update = JSON.parse(body);

        // Telegram needs an immediate successful response.
        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
          ok: true
        }));

        await handleWebhook(update);

      } catch (error) {
        console.error("Request error:", error);

        if (!res.headersSent) {
          res.writeHead(400, {
            "Content-Type": "application/json"
          });

          res.end(JSON.stringify({
            ok: false
          }));
        }
      }
    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not Found");
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Telegram Marketplace running on port ${PORT}`
  );
});