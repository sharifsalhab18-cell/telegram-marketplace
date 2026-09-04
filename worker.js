 export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Telegram Marketplace Bot is running");
    }

    try {
      const update = await request.json();

      if (!update.message) {
        return new Response("OK");
      }

      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      if (text === "/start") {
        await sendTelegram(
          env.TELEGRAM_BOT_TOKEN,
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

      if (update.callback_query) {
        const query = update.callback_query;
        const chatId = query.message.chat.id;

        if (query.data === "agree") {
          await sendTelegram(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "🛍️ أهلاً بك في السوق!\n\n" +
            "اختر ما تريد:\n\n" +
            "🛒 أريد شراء\n" +
            "📦 أريد بيع\n" +
            "💬 التفاوض وإتمام الصفقة\n" +
            "👤 حسابي"
          );

          await answerCallback(
            env.TELEGRAM_BOT_TOKEN,
            query.id
          );
        }
      }

      return new Response("OK");

    } catch (error) {
      return new Response("Error", { status: 500 });
    }
  }
};

async function sendTelegram(token, chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
}

async function answerCallback(token, callbackId) {
  await fetch(
    `https://api.telegram.org/bot${token}/answerCallbackQuery`,
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