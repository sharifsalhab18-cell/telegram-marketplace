const http = require("http");

const PORT = process.env.PORT || 5000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

const sessions = {};


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
// OLX / APIFY
// ======================================================

async function searchOLX(product, maxPrice, region) {

  if (!APIFY_TOKEN) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }

  /*
   * We search OLX using the actor we selected:
   * maroon_trio/olx-ua-scraper-parser
   *
   * The actor accepts an OLX URL as input.
   */

  const searchText = region
    ? `${product} ${region}`
    : product;

  const encodedQuery = encodeURIComponent(searchText);

  const olxUrl =
    `https://www.olx.ua/uk/list/q-${encodedQuery}/`;

  const apiUrl =
    `https://api.apify.com/v2/acts/` +
    `maroon_trio~olx-ua-scraper-parser/` +
    `run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`;

  console.log("OLX search:", olxUrl);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: olxUrl
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Apify error:",
      response.status,
      errorText
    );

    throw new Error(
      `Apify request failed: ${response.status}`
    );
  }

  const items = await response.json();

  if (!Array.isArray(items)) {
    console.error("Unexpected Apify response:", items);
    return [];
  }

  console.log(
    `Apify returned ${items.length} items`
  );

  // ----------------------------------------------------
  // Normalize results
  // ----------------------------------------------------

  const results = [];

  for (const item of items) {

    const title =
      item.title ||
      item.name ||
      item.heading ||
      item.adTitle ||
      "";

    const url =
      item.url ||
      item.link ||
      item.adUrl ||
      item.listingUrl ||
      "";

    const location =
      item.location ||
      item.city ||
      item.region ||
      item.address ||
      "";

    let price =
      item.price ??
      item.priceValue ??
      item.amount ??
      item.priceUAH ??
      null;

    // Some scrapers return price as an object
    if (
      price &&
      typeof price === "object"
    ) {
      price =
        price.value ??
        price.amount ??
        price.raw ??
        null;
    }

    // Convert string price to number
    if (typeof price === "string") {

      const numeric = price
        .replace(/\s/g, "")
        .replace(/[^0-9.,]/g, "")
        .replace(",", ".");

      price = Number(numeric);
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price)
    ) {
      price = null;
    }

    const description =
      item.description ||
      item.shortDescription ||
      "";

    const image =
      item.image ||
      item.imageUrl ||
      item.photo ||
      item.thumbnail ||
      "";

    // --------------------------------------------------
    // Filter by maximum purchase price
    // --------------------------------------------------

    if (
      price !== null &&
      price > maxPrice
    ) {
      continue;
    }

    results.push({
      title: title || product,
      price,
      location,
      description,
      image,
      url
    });
  }

  // ----------------------------------------------------
  // Sort: cheapest first
  // ----------------------------------------------------

  results.sort((a, b) => {

    if (a.price === null) return 1;
    if (b.price === null) return -1;

    return a.price - b.price;
  });

  // Maximum results shown to user
  return results.slice(0, 10);
}


// ======================================================
// SEND OLX RESULTS
// ======================================================

async function sendOLXResults(chatId, session, results) {

  if (!results.length) {

    await sendTelegram(
      chatId,
      "🔎 انتهى البحث في OLX.ua.\n\n" +
      "لم نجد إعلانات مطابقة لأقصى سعر محدد.\n\n" +
      `🛒 المنتج: ${session.product}\n` +
      `💰 أقصى سعر: ${formatPrice(session.maxPrice)}\n` +
      `📍 المنطقة: ${session.region}\n\n` +
      "يمكنك تجربة سعر أعلى أو منطقة أخرى."
    );

    return;
  }

  await sendTelegram(
    chatId,
    "🔎 تم العثور على إعلانات في OLX.ua.\n\n" +
    `🛒 المنتج: ${session.product}\n` +
    `💰 أقصى سعر: ${formatPrice(session.maxPrice)}\n` +
    `📍 المنطقة: ${session.region}\n\n` +
    `📋 عدد النتائج المناسبة: ${results.length}`
  );

  for (let i = 0; i < results.length; i++) {

    const item = results[i];

    let message =
      `📌 نتيجة ${i + 1}\n\n` +
      `🛒 ${item.title}\n` +
      `💰 السعر: ${formatPrice(item.price)}\n`;

    if (item.location) {
      message += `📍 ${item.location}\n`;
    }

    if (item.description) {

      let shortDescription =
        String(item.description)
          .replace(/\s+/g, " ")
          .trim();

      if (shortDescription.length > 300) {
        shortDescription =
          shortDescription.slice(0, 300) + "...";
      }

      message +=
        `\n📝 ${shortDescription}\n`;
    }

    if (item.url) {
      message +=
        `\n🔗 ${item.url}`;
    }

    await sendTelegram(
      chatId,
      message
    );
  }
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

    if (!query.message) {
      await answerCallback(query.id);
      return;
    }

    const chatId = query.message.chat.id;

    // --------------------------------------------------
    // AGREE
    // --------------------------------------------------

    if (query.data === "agree") {

      await sendTelegram(
        chatId,
        "🛍️ أهلاً بك في السوق!\n\n" +
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

      await answerCallback(query.id);
      return;
    }

    // --------------------------------------------------
    // BUY
    // --------------------------------------------------

    if (query.data === "buy") {

      sessions[chatId] = {
        step: "buy_product"
      };

      await sendTelegram(
        chatId,
        "🛒 شراء منتج\n\n" +
        "أرسل اسم المنتج الذي تبحث عنه.\n\n" +
        "مثال: iPhone 14"
      );

      await answerCallback(query.id);
      return;
    }

    // --------------------------------------------------
    // SELL
    // --------------------------------------------------

    if (query.data === "sell") {

      sessions[chatId] = {
        step: "sell_product"
      };

      await sendTelegram(
        chatId,
        "📦 بيع منتج\n\n" +
        "أرسل اسم المنتج الذي تريد عرضه للبيع."
      );

      await answerCallback(query.id);
      return;
    }

    // --------------------------------------------------
    // NEGOTIATE
    // --------------------------------------------------

    if (query.data === "negotiate") {

      await sendTelegram(
        chatId,
        "💬 التفاوض وإتمام الصفقة\n\n" +
        "هذه الخدمة سيتم ربطها بالإعلان المختار بعد تجهيز مراحل الشراء والبيع."
      );

      await answerCallback(query.id);
      return;
    }

    // --------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------

    if (query.data === "account") {

      await sendTelegram(
        chatId,
        "👤 حسابي\n\n" +
        "سيتم تجهيز حساب المستخدم في المرحلة التالية."
      );

      await answerCallback(query.id);
      return;
    }

    await answerCallback(query.id);
    return;
  }


  // ====================================================
  // NORMAL MESSAGE
  // ====================================================

  if (!body.message) {
    return;
  }

  const chatId = body.message.chat.id;
  const text = (body.message.text || "").trim();


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
    sessions[chatId].step = "buy_max_price";

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

    const price = parsePrice(text);

    if (!price) {

      await sendTelegram(
        chatId,
        "⚠️ السعر غير صحيح.\n\n" +
        "أرسل رقمًا صحيحًا.\n\n" +
        "مثال: 25000"
      );

      return;
    }

    sessions[chatId].maxPrice = price;
    sessions[chatId].step = "buy_region";

    await sendTelegram(
      chatId,
      "💰 أقصى سعر للشراء: " +
      formatPrice(price) +
      "\n\n" +
      "📍 أرسل المنطقة أو المدينة التي تريد البحث فيها.\n\n" +
      "مثال: Київ"
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

    sessions[chatId].region = text;
    sessions[chatId].step = "buy_searching";

    const session = sessions[chatId];

    await sendTelegram(
      chatId,
      "🔎 بدأ البحث الحقيقي في OLX.ua...\n\n" +
      `🛒 المنتج: ${session.product}\n` +
      `💰 أقصى سعر: ${formatPrice(session.maxPrice)}\n` +
      `📍 المنطقة: ${session.region}\n\n` +
      "⏳ انتظر قليلًا..."
    );

    try {

      const results = await searchOLX(
        session.product,
        session.maxPrice,
        session.region
      );

      await sendOLXResults(
        chatId,
        session,
        results
      );

      sessions[chatId].step = "buy_results";

    } catch (error) {

      console.error(
        "OLX search error:",
        error
      );

      await sendTelegram(
        chatId,
        "❌ حدث خطأ أثناء البحث في OLX.ua.\n\n" +
        "تأكد من إعداد APIFY_API_TOKEN في Render ثم حاول مرة أخرى."
      );

      sessions[chatId].step = "buy_region";
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

    sessions[chatId].product = text;
    sessions[chatId].step = "sell_description";

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

    sessions[chatId].description = text;
    sessions[chatId].step = "sell_price";

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

    const price = parsePrice(text);

    if (!price) {

      await sendTelegram(
        chatId,
        "⚠️ السعر غير صحيح.\n\n" +
        "أرسل رقمًا صحيحًا.\n\n" +
        "مثال: 25000"
      );

      return;
    }

    sessions[chatId].price = price;
    sessions[chatId].step = "sell_region";

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

    sessions[chatId].region = text;
    sessions[chatId].step = "sell_summary";

    const session = sessions[chatId];

    await sendTelegram(
      chatId,
      "✅ تم تسجيل عرض البيع.\n\n" +
      "📦 المنتج: " +
      session.product +
      "\n\n" +
      "📝 الوصف والحالة:\n" +
      session.description +
      "\n\n" +
      "💰 السعر: " +
      formatPrice(session.price) +
      "\n" +
      "📍 المنطقة: " +
      session.region +
      "\n\n" +
      "📋 بيانات العرض مكتملة.\n\n" +
      "الخطوة التالية ستكون تجهيز نشر العرض واستقبال المشترين."
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

const server = http.createServer((req, res) => {

  // ====================================================
  // HOME
  // ====================================================

  if (
    req.method === "GET" &&
    req.url === "/"
  ) {

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(`
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telegram Marketplace</title>
      </head>
      <body>
        <h1>Telegram Marketplace</h1>
        <p>Сервіс працює.</p>
      </body>
      </html>
    `);

    return;
  }


  // ====================================================
  // WEBHOOK
  // ====================================================

  if (
    req.method === "POST" &&
    req.url === "/webhook"
  ) {

    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {

      try {

        const body = JSON.parse(data);

        /*
         * Respond to Telegram immediately.
         * The OLX search can take some time.
         */

        res.writeHead(200, {
          "Content-Type": "text/plain"
        });

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

        res.writeHead(400, {
          "Content-Type": "text/plain"
        });

        res.end("Bad Request");
      }
    });

    return;
  }


  // ====================================================
  // NOT FOUND
  // ====================================================

  res.writeHead(404);
  res.end("Not Found");
});


// ======================================================
// START SERVER
// ======================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Telegram Marketplace server running on port ${PORT}`
    );

  }
);