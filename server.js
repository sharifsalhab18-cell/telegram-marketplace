const http = require("http");

const PORT = process.env.PORT || 5000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const sessions = {};

// =========================
// TELEGRAM
// =========================

async function sendTelegram(chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    console.error("Telegram sendMessage error:", await response.text());
  }
}

async function answerCallback(callbackId) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`,
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

// =========================
// MAIN WEBHOOK
// =========================

async function handleWebhook(body) {

  // =========================
  // CALLBACK BUTTONS
  // =========================

  if (body.callback_query) {

    const query = body.callback_query;

    if (!query.message) {
      await answerCallback(query.id);
      return;
    }

    const chatId = query.message.chat.id;

    // =========================
    // AGREE
    // =========================

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

    // =========================
    // BUY
    // =========================

    if (query.data === "buy") {

      sessions[chatId] = {
        step: "buy_product"
      };

      await sendTelegram(
        chatId,
        "🛒 شراء منتج\n\n" +
        "أرسل اسم المنتج الذي تبحث عنه."
      );

      await answerCallback(query.id);
      return;
    }

    // =========================
    // SELL
    // =========================

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

    // =========================
    // NEGOTIATE
    // =========================

    if (query.data === "negotiate") {

      await sendTelegram(
        chatId,
        "💬 التفاوض وإتمام الصفقة\n\n" +
        "سيتم تجهيز هذه الخدمة بعد الانتهاء من خطوات الشراء والبيع."
      );

      await answerCallback(query.id);
      return;
    }

    // =========================
    // ACCOUNT
    // =========================

    if (query.data === "account") {

      await sendTelegram(
        chatId,
        "👤 حسابي\n\n" +
        "سيتم تجهيز حساب المستخدم في خطوة لاحقة."
      );

      await answerCallback(query.id);
      return;
    }

    await answerCallback(query.id);
    return;
  }

  // =========================
  // MESSAGE
  // =========================

  if (!body.message) {
    return;
  }

  const chatId = body.message.chat.id;
  const text = (body.message.text || "").trim();

  // =========================
  // START
  // =========================

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

  // =========================
  // BUY - PRODUCT
  // =========================

  if (sessions[chatId]?.step === "buy_product") {

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
      "💰 الآن أرسل أقصى سعر تريد دفعه للمنتج.\n\n" +
      "مثال: 25000"
    );

    return;
  }

  // =========================
  // BUY - MAX PRICE
  // =========================

  if (sessions[chatId]?.step === "buy_max_price") {

    const normalizedPrice = text
      .replace(/\s/g, "")
      .replace(",", ".");

    const price = Number(normalizedPrice);

    if (!Number.isFinite(price) || price <= 0) {

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
      price +
      "\n\n" +
      "📍 الآن أرسل المنطقة أو المدينة التي تريد البحث فيها.\n\n" +
      "مثال: Київ"
    );

    return;
  }

  // =========================
  // BUY - REGION
  // =========================

  if (sessions[chatId]?.step === "buy_region") {

    if (!text) {
      await sendTelegram(
        chatId,
        "⚠️ أرسل اسم المنطقة أو المدينة."
      );
      return;
    }

    sessions[chatId].region = text;
    sessions[chatId].step = "buy_summary";

    const session = sessions[chatId];

    await sendTelegram(
      chatId,
      "✅ تم تسجيل طلب الشراء.\n\n" +
      "🛒 المنتج: " +
      session.product +
      "\n" +
      "💰 أقصى سعر: " +
      session.maxPrice +
      "\n" +
      "📍 المنطقة: " +
      session.region +
      "\n\n" +
      "📋 بيانات الطلب مكتملة.\n\n" +
      "الخطوة التالية ستكون تجهيز عملية البحث عن المنتج."
    );

    return;
  }

  // =========================
  // SELL - PRODUCT
  // =========================

  if (sessions[chatId]?.step === "sell_product") {

    if (!text) {
      await sendTelegram(
        chatId,
        "⚠️ أرسل اسم المنتج من فضلك."
      );
      return;
    }

    sessions[chatId].product = text;
    sessions[chatId].step = "sell_details";

    await sendTelegram(
      chatId,
      "📦 المنتج المعروض للبيع:\n" +
      text +
      "\n\n" +
      "سيتم تجهيز تفاصيل البيع في الخطوة التالية."
    );

    return;
  }

  // =========================
  // UNKNOWN MESSAGE
  // =========================

  await sendTelegram(
    chatId,
    "ℹ️ استخدم /start للبدء من جديد."
  );
}


// =========================
// HTTP SERVER
// =========================

const server = http.createServer((req, res) => {

  // =========================
  // HOME
  // =========================

  if (req.method === "GET" && req.url === "/") {

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

  // =========================
  // WEBHOOK
  // =========================

  if (req.method === "POST" && req.url === "/webhook") {

    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", async () => {

      try {

        const body = JSON.parse(data);

        await handleWebhook(body);

        res.writeHead(200, {
          "Content-Type": "text/plain"
        });

        res.end("OK");

      } catch (error) {

        console.error("Webhook error:", error);

        res.writeHead(500, {
          "Content-Type": "text/plain"
        });

        res.end("Error");
      }
    });

    return;
  }

  // =========================
  // NOT FOUND
  // =========================

  res.writeHead(404);
  res.end("Not Found");
});


// =========================
// START SERVER
// =========================

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Telegram Marketplace server running on port ${PORT}`
  );
});