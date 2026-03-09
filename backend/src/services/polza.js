import { config } from "../config.js";

function getMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
  }

  return "";
}

export async function generatePolzaRecommendationText({ userPrompt }) {
  if (!config.polzaApiKey) {
    const err = new Error("ИИ-провайдер не настроен: укажите POLZA_API_KEY на сервере.");
    err.statusCode = 503;
    throw err;
  }

  let response;
  try {
    response = await fetch(`${config.polzaBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.polzaApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.polzaModel,
        temperature: 0.7,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "Ты ассистент по рекомендациям фильмов. Верни строго один валидный JSON-объект и ничего, кроме JSON. Все текстовые поля должны быть на русском языке."
          },
          { role: "user", content: userPrompt }
        ]
      })
    });
  } catch (cause) {
    const err = new Error("Сервис ИИ временно недоступен.");
    err.statusCode = 502;
    err.cause = cause;
    throw err;
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const err = new Error("Ошибка запроса к ИИ-провайдеру.");
    err.statusCode = 502;
    err.providerStatus = response.status;
    err.providerDetails = details.slice(0, 500);
    throw err;
  }

  const payload = await response.json();
  const text = getMessageContent(payload);
  if (!text) {
    const err = new Error("ИИ-провайдер вернул пустой ответ.");
    err.statusCode = 502;
    throw err;
  }

  return {
    text,
    model: config.polzaModel
  };
}
