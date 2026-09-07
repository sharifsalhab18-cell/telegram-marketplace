const http = require("http");

const PORT = process.env.PORT || 5000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const sessions = {};

// ======================================================
// MARKETPLACE
// ======================================================

// التخزين الحالي مؤقت في الذاكرة.
// لاحقًا سنربطه بقاعدة بيانات حتى لا تختفي العروض عند إعادة تشغيل Render.
const listings = [];

let nextListingId = 1;


// ======================================================
// TELEGRAM
// ======================================================

async function sendTelegram(chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text: text
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


async function answerCallback(callbackId) {
  const response = await fetch(
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

  if (!response.ok) {
    console.error(
      "Telegram answerCallbackQuery error:",
      await response.text()
    );
  }
}


// ======================================================
// MAIN MENU
// ======================================================

async function showMainMenu(chatId) {
  await sendTelegram(
    chatId,
    "🛍️ أهلاً بك في سوق تيليجرام!\n\n" +
    "اختر ما تريد:",
    {
      inline_keyboard: [
        [
          {
            text: "🛒 أريد شراء",
            callback_data: "buy"
          }
        ],
        [
          {
            text: "📦 أريد بيع",
            callback_data: "sell"
          }
        ],
        [
          {
            text: "💬 التفاوض وإتمام الصفقة",
            callback_data: "negotiate"
          }
        ],
        [
          {
            text: "👤 حسابي",
            callback_data: "account"
          }
        ]
      ]
    }
  );
}


// ======================================================
// PRICE
// ======================================================

function parsePrice(text) {
  const normalized = String(text)
    .replace(/\s/g, "")
    .replace(/₴/g, "")
    .replace(",", ".");

  const price = Number(normalized);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}


function formatPrice(price) {
  if (price === null || price === undefined) {
    return "غير محدد";
  }

  return `${Math.round(price).toLocaleString("uk-UA")} ₴`;
}


// ======================================================
// TEXT NORMALIZATION
// ======================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase();
}


// ======================================================
// INTERNAL MARKETPLACE SEARCH
// ======================================================

function searchListings(product, maxPrice, region) {
  const wantedProduct = normalizeText(product);
  const wantedRegion = normalizeText(region);

  const results = listings.filter((listing) => {

    if (listing.status !== "active") {
      return false;
    }

    if (listing.price > maxPrice) {
      return false;
    }

    const listingProduct =
      normalizeText(listing.product);

    const listingRegion =
      normalizeText(listing.region);

    const productMatch =
      listingProduct.includes(wantedProduct) ||
      wantedProduct.includes(listingProduct);

    if (!productMatch) {
      return false;
    }

    // إذا كتب المشتري "الكل" نبحث في جميع المناطق.
    if (
      wantedRegion &&
      wantedRegion !== "الكل" &&
      wantedRegion !== "будь-яка" &&
      !listingRegion.includes(wantedRegion) &&
      !wantedRegion.includes(listingRegion)
    ) {
      return false;
    }

    return true;
  });

  results.sort((a, b) => {
    return a.price - b.price;
  });

  return results.slice(0, 10);
}


// ======================================================
// SEND MARKETPLACE RESULTS
// ======================================================

async function sendMarketplaceResults(
  chatId,
  session,
  results
) {

  if (!results.length) {

    await sendTelegram(
      chatId,
      "🔎 انتهى البحث في سوقنا.\n\n" +
      "لم نجد حاليًا عروضًا مطابقة لطلبك.\n\n" +
      `🛒 المنتج: ${session.product}\n` +
      `💰 أقصى سعر: ${formatPrice(session.maxPrice)}\n` +
      `📍 المنطقة: ${session.region}\n\n` +
      "يمكنك تجربة منتج آخر أو سعر أعلى."
    );

    await sendTelegram(
      chatId,
      "ماذا تريد أن تفعل؟",
      {
        inline_keyboard: [
          [
            {
              text: "🔄 بحث جديد",
              callback_data: "buy"
            }
          ],
          [
            {
              text: "🏠 القائمة الرئيسية",
              callback_data: "menu"
            }
          ]
        ]
      }
    );

    return;
  }


  await sendTelegram(
    chatId,
    "🔎 وجدنا عروضًا في سوقنا!\n\n" +
    `🛒 المنتج: ${session.product}\n` +
    `💰 أقصى سعر: ${formatPrice(session.maxPrice)}\n` +
    `📍 المنطقة: ${session.region}\n\n` +
    `📋 عدد العروض المناسبة: ${results.length}`
  );


  for (let i = 0; i < results.length; i++) {

    const item = results[i];

    let message =
      `📌 عرض رقم #${item.id}\n\n` +
      `🛒 ${item.product}\n` +
      `💰 السعر: ${formatPrice(item.price)}\n` +
      `📍 المنطقة: ${item.region}\n`;

    if (item.description) {

      let shortDescription =
        String(item.description)
          .replace(/\s+/g, " ")
          .trim();

      if (shortDescription.length > 400) {
        shortDescription =
          shortDescription.slice(0, 400) + "...";
      }

      message +=
        `\n📝 ${shortDescription}\n`;
    }


    await sendTelegram(
      chatId,
      message,
      {
        inline_keyboard: [
          [
            {
              text: "💬 تواصل مع البائع",
              callback_data: `contact_${item.id}`
            }
          ]
        ]
      }
    );
  }


  await sendTelegram(
    chatId,
    "هل تريد إجراء بحث آخر؟",
    {
      inline_keyboard: [
        [
          {
            text: "🔄 بحث جديد",
            callback_data: "buy"
          }
        ],
        [
          {
            text: "🏠 القائمة الرئيسية",
            callback_data: "menu"
          }
        ]
      ]
    }
  );
}


// ======================================================
// CREATE LISTING
// ======================================================

function createListing(chatId, session) {

  const listing = {
    id: nextListingId++,

    sellerChatId: chatId,

    product: session.product,

    description: session.description,

    price: session.price,

    region: session.region,

    status: "active",

    createdAt: new Date().toISOString()
  };

  listings.push(listing);

  return listing;
}


// ======================================================
// CONTACT SELLER
// ======================================================

async function contactSeller(
  buyerChatId,
  listingId
) {

  const listing = listings.find(
    (item) =>
      item.id === listingId &&
      item.status === "active"
  );


  if (!listing) {

    await sendTelegram(
      buyerChatId,
      "❌ هذا العرض لم يعد متاحًا."
    );

    return;
  }


  // لا نعرض رقم أو معرف البائع للمشتري.
  // التواصل يتم من خلال البوت.

  await sendTelegram(
    listing.sellerChatId,
    "📩 لديك مشتري مهتم بعرضك!\n\n" +
    `🆔 رقم العرض: #${listing.id}\n` +
    `🛒 المنتج: ${listing.product}\n` +
    `💰 السعر: ${formatPrice(listing.price)}\n` +
    `📍 المنطقة: ${listing.region}\n\n` +
    "يمكنك الرد على المشتري من خلال المحادثة مع البوت."
  );


  await sendTelegram(
    buyerChatId,
    "✅ تم إرسال طلب التواصل إلى البائع.\n\n" +
    "سيتم إبلاغ البائع بأن هناك مشتريًا مهتمًا بالعرض."
  );
}


// ======================================================
// MAIN WEBHOOK
// ======================================================

async function handleWebhook(body) {

  // ====================================================
  // CALLBACK BUTTONS
  // ====================================================

  if (body.callback_query) {

    const query = body.callback_query;

    await answerCallback(query.id);

    if (!query.message) {
      return;
    }

    const chatId = query.message.chat.id;
    const data = query.data;


    // --------------------------------------------------
    // AGREE
    // --------------------------------------------------

    if (data === "agree") {

      sessions[chatId] = {
        step: "menu"
      };

      await showMainMenu(chatId);

      return;
    }


    // --------------------------------------------------
    // MENU
    // --------------------------------------------------

    if (data === "menu") {

      sessions[chatId] = {
        step: "menu"
      };

      await showMainMenu(chatId);

      return;
    }


    // --------------------------------------------------
    // BUY
    // --------------------------------------------------

    if (data === "buy") {

      sessions[chatId] = {
        step: "buy_product"
      };

      await sendTelegram(
        chatId,
        "🛒 شراء منتج\n\n" +
        "أرسل اسم المنتج الذي تبحث عنه.\n\n" +
        "مثال: iPhone 14"
      );

      return;
    }


    // --------------------------------------------------
    // SELL
    // --------------------------------------------------

    if (data === "sell") {

      sessions[chatId] = {
        step: "sell_product"
      };

      await sendTelegram(
        chatId,
        "📦 بيع منتج\n\n" +
        "أرسل اسم المنتج الذي تريد عرضه للبيع."
      );

      return;
    }


    // --------------------------------------------------
    // NEGOTIATE
    // --------------------------------------------------

    if (data === "negotiate") {

      await sendTelegram(
        chatId,
        "💬 التفاوض وإتمام الصفقة\n\n" +
        "هذه الخدمة سيتم تجهيزها وربطها بالعرض والمشتري في المرحلة التالية."
      );

      return;
    }


    // --------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------

    if (data === "account") {

      const myListings =
        listings.filter(
          (item) =>
            item.sellerChatId === chatId &&
            item.status === "active"
        );

      await sendTelegram(
        chatId,
        "👤 حسابي\n\n" +
        `📦 عدد عروضك الحالية: ${myListings.length}\n\n` +
        "سيتم تطوير قسم الحساب وإدارة العروض في المرحلة التالية."
      );

      return;
    }


    // --------------------------------------------------
    // CONTACT SELLER
    // --------------------------------------------------

    if (data.startsWith("contact_")) {

      const idText =
        data.replace("contact_", "");

      const listingId =
        Number(idText);

      if (
        Number.isInteger(listingId) &&
        listingId > 0
      ) {

        await contactSeller(
          chatId,
          listingId
        );

      } else {

        await sendTelegram(
          chatId,
          "❌ رقم العرض غير صحيح."
        );
      }

      return;
    }


    return;
  }


  // ====================================================
  // NORMAL MESSAGE
  // ====================================================

  if (!body.message) {
    return;
  }


  const chatId =
    body.message.chat.id;

  const text =
    (body.message.text || "").trim();


  // ====================================================
  // START
  // ====================================================

  if (text === "/start") {

    sessions[chatId] = {
      step: "start"
    };

    await sendTelegram(
      chatId,
      "🛍️ مرحباً بك في سوق تيليجرام\n\n" +
      "سوق خاص للبيع والشراء والتفاوض وإتمام الصفقات.\n\n" +
      "🔒 خصوصية المستخدمين محفوظة.\n\n" +
      "💰 عمولة المنصة: 5%\n" +
      "2.5% على المشتري + 2.5% على البائع\n\n" +
      "للدخول إلى السوق اضغط على الزر أدناه.",
      {
        inline_keyboard: [
          [
            {
              text: "✅ أوافق وأدخل السوق",
              callback_data: "agree"
            }
          ]
        ]
      }
    );

    return;
  }


  // ====================================================
  // CANCEL
  // ====================================================

  if (text === "/cancel") {

    sessions[chatId] = {
      step: "menu"
    };

    await sendTelegram(
      chatId,
      "❌ تم إلغاء العملية."
    );

    await showMainMenu(chatId);

    return;
  }


  // ====================================================
  // MENU
  // ====================================================

  if (text === "/menu") {

    sessions[chatId] = {
      step: "menu"
    };

    await showMainMenu(chatId);

    return;
  }


  // ====================================================
  // BUY - PRODUCT
  // ====================================================

  if (
    sessions[chatId]?.step === "buy_product"
  ) {

    if (!text) {

      await sendTelegram(
        chatId,
        "⚠️ أرسل اسم المنتج من فضلك."
      );

      return;
    }


    sessions[chatId].product = text;

    sessions[chatId].step =
      "buy_max_price";


    await sendTelegram(
      chatId,
      "🛒 المنتج:\n" +
      text +
      "\n\n" +
      "💰 أرسل أقصى سعر تريد دفعه للمنتج.\n\n" +
      "مثال: 25000"
    );

    return;
  }


  // ====================================================
  // BUY - MAX PRICE
  // ====================================================

  if (
    sessions[chatId]?.step === "buy_max_price"
  ) {

    const price =
      parsePrice(text);


    if (!price) {

      await sendTelegram(
        chatId,
        "⚠️ السعر غير صحيح.\n\n" +
        "أرسل رقمًا صحيحًا.\n\n" +
        "مثال: 25000"
      );

      return;
    }


    sessions[chatId].maxPrice =
      price;

    sessions[chatId].step =
      "buy_region";


    await sendTelegram(
      chatId,
      "💰 أقصى سعر للشراء: " +
      formatPrice(price) +
      "\n\n" +
      "📍 أرسل المنطقة أو المدينة التي تريد البحث فيها.\n\n" +
      "مثال: Київ\n\n" +
      "أو اكتب: الكل"
    );

    return;
  }


  // ====================================================
  // BUY - REGION
  // ====================================================

  if (
    sessions[chatId]?.step === "buy_region"
  ) {

    if (!text) {

      await sendTelegram(
        chatId,
        "⚠️ أرسل اسم المنطقة أو المدينة."
      );

      return;
    }


    sessions[chatId].region =
      text;

    sessions[chatId].step =
      "buy_searching";


    const session =
      sessions[chatId];


    await sendTelegram(
      chatId,
      "🔎 أبحث الآن في عروض سوقنا...\n\n" +
      `🛒 المنتج: ${session.product}\n` +
      `💰 أقصى سعر: ${formatPrice(session.maxPrice)}\n` +
      `📍 المنطقة: ${session.region}\n\n` +
      "⏳ لحظة من فضلك..."
    );


    try {

      const results =
        searchListings(
          session.product,
          session.maxPrice,
          session.region
        );


      await sendMarketplaceResults(
        chatId,
        session,
        results
      );


      sessions[chatId].step =
        "buy_results";


    } catch (error) {

      console.error(
        "Marketplace search error:",
        error
      );


      await sendTelegram(
        chatId,
        "❌ حدث خطأ أثناء البحث في سوقنا.\n\n" +
        "حاول مرة أخرى."
      );


      sessions[chatId].step =
        "buy_region";
    }


    return;
  }


  // ====================================================
  // SELL - PRODUCT
  // ====================================================

  if (
    sessions[chatId]?.step === "sell_product"
  ) {

    if (!text) {

      await sendTelegram(
        chatId,
        "⚠️ أرسل اسم المنتج من فضلك."
      );

      return;
    }


    sessions[chatId].product =
      text;

    sessions[chatId].step =
      "sell_description";


    await sendTelegram(
      chatId,
      "📦 المنتج:\n" +
      text +
      "\n\n" +
      "📝 أرسل وصف المنتج وحالته.\n\n" +
      "مثال: iPhone 14 بحالة ممتازة، بطارية 90%."
    );

    return;
  }


  // ====================================================
  // SELL - DESCRIPTION
  // ====================================================

  if (
    sessions[chatId]?.step === "sell_description"
  ) {

    if (!text) {

      await sendTelegram(
        chatId,
        "⚠️ أرسل وصف المنتج وحالته."
      );

      return;
    }


    sessions[chatId].description =
      text;

    sessions[chatId].step =
      "sell_price";


    await sendTelegram(
      chatId,
      "💰 أرسل السعر الذي تريد بيع المنتج به.\n\n" +
      "مثال: 25000"
    );

    return;
  }


  // ====================================================
  // SELL - PRICE
  // ====================================================

  if (
    sessions[chatId]?.step === "sell_price"
  ) {

    const price =
      parsePrice(text);


    if (!price) {

      await sendTelegram(
        chatId,
        "⚠️ السعر غير صحيح.\n\n" +
        "أرسل رقمًا صحيحًا.\n\n" +
        "مثال: 25000"
      );

      return;
    }


    sessions[chatId].price =
      price;

    sessions[chatId].step =
      "sell_region";


    await sendTelegram(
      chatId,
      "💰 سعر البيع: " +
      formatPrice(price) +
      "\n\n" +
      "📍 أرسل المنطقة أو المدينة التي يوجد فيها المنتج.\n\n" +
      "مثال: Київ"
    );

    return;
  }


  // ====================================================
  // SELL - REGION
  // ====================================================

  if (
    sessions[chatId]?.step === "sell_region"
  ) {

    if (!text) {

      await sendTelegram(
        chatId,
        "⚠️ أرسل المنطقة أو المدينة."
      );

      return;
    }


    sessions[chatId].region =
      text;


    const session =
      sessions[chatId];


    // إنشاء العرض داخل سوقنا
    const listing =
      createListing(
        chatId,
        session
      );


    await sendTelegram(
      chatId,
      "✅ تم نشر عرضك في سوق تيليجرام!\n\n" +
      `🆔 رقم العرض: #${listing.id}\n\n` +
      `📦 المنتج: ${listing.product}\n\n` +
      `📝 الوصف والحالة:\n${listing.description}\n\n` +
      `💰 السعر: ${formatPrice(listing.price)}\n` +
      `📍 المنطقة: ${listing.region}\n\n` +
      "🔎 أصبح العرض متاحًا للمشترين الذين يبحثون عن هذا المنتج."
    );


    sessions[chatId] = {
      step: "menu"
    };


    await sendTelegram(
      chatId,
      "ماذا تريد أن تفعل الآن؟",
      {
        inline_keyboard: [
          [
            {
              text: "📦 إضافة عرض آخر",
              callback_data: "sell"
            }
          ],
          [
            {
              text: "🛒 البحث عن منتج",
              callback_data: "buy"
            }
          ],
          [
            {
              text: "🏠 القائمة الرئيسية",
              callback_data: "menu"
            }
          ]
        ]
      }
    );

    return;
  }


  // ====================================================
  // UNKNOWN MESSAGE
  // ====================================================

  await sendTelegram(
    chatId,
    "ℹ️ استخدم /start للبدء من جديد."
  );
}


// ======================================================
// HTTP SERVER
// ======================================================

const server =
  http.createServer((req, res) => {

    // ==================================================
    // HOME
    // ==================================================

    if (
      req.method === "GET" &&
      req.url === "/"
    ) {

      res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
});

res.end(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    >
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

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        const body = JSON.parse(data);

        res.writeHead(200, {
          "Content-Type": "text/plain"
        });

        res.end("OK");

        handleWebhook(body).catch((error) => {
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