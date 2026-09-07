const http = require("http");

const PORT = process.env.PORT || 5000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
}

async function answerCallback(callbackId) {
  await fetch(
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
}

async function handleWebhook(body) {
  if (body.callback_query) {
    const query = body.callback_query;
    const chatId = query.message.chat.id;

    if (query.data === "agree") {
      await sendTelegram(
        chatId,
        "🛍️ أهلاً بك في السوق!\n\n" +
        "اختر ما تريد:\n\n" +
        "🛒 أريد شراء\n" +
        "📦 أريد بيع\n" +
        "💬 التفاوض وإتمام الصفقة\n" +
        "👤 حسابي"
      );

      await answerCallback(query.id);
    }

    return;
  }

  if (!body.message) {
    return;
  }

  const chatId = body.message.chat.id;
  const text = body.message.text || "";

  if (text === "/start") {
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
  }
}

const server = http.createServer(async (req, res) => {
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

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Telegram Marketplace server running on port ${PORT}`);
});