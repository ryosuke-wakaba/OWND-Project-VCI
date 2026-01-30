import { fileURLToPath } from "url";
import path, { dirname } from "path";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import type { Middleware } from "koa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename)
  .replace(/\/dist(\/.*)?$/, "")
  .replace(/\/src(\/.*)?$/, "");

export const initI18n = async () => {
  await i18next.use(Backend).init({
    fallbackLng: "ja",
    supportedLngs: ["ja", "en"],
    preload: ["ja", "en"],
    ns: ["common", "learners", "keys", "metadata", "wallet"],
    defaultNS: "common",
    backend: {
      loadPath: path.join(__dirname, "locales/{{lng}}/{{ns}}.json"),
    },
    interpolation: {
      escapeValue: false,
    },
  });

  return i18next;
};

/**
 * Parse Accept-Language header and return the best matching language
 */
function detectLanguage(acceptLanguage: string | undefined): string {
  if (!acceptLanguage) return "ja";

  const supportedLngs = ["ja", "en"];

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,ja;q=0.8")
  const languages = acceptLanguage
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1.0;
      return { lang: lang.toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  // Find the first supported language
  for (const { lang } of languages) {
    // Check exact match
    if (supportedLngs.includes(lang)) {
      return lang;
    }
    // Check language code without region (e.g., "en-US" -> "en")
    const langCode = lang.split("-")[0];
    if (supportedLngs.includes(langCode)) {
      return langCode;
    }
  }

  return "ja";
}

/**
 * Koa middleware for i18next language detection and translation
 */
export const i18nMiddleware: Middleware = async (ctx, next) => {
  const acceptLanguage = ctx.request.headers["accept-language"];
  const lng = detectLanguage(acceptLanguage);

  // Create a translation function bound to the detected language
  const t = i18next.getFixedT(lng);

  // Add translation function and language to state (for templates)
  ctx.state.t = t;
  ctx.state.lng = lng;

  await next();
};

export default i18next;
