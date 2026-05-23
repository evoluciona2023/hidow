/**
 * Scrapes hidow.com to build products.json and faq.json
 * Run once: npm run scrape
 * Uses Puppeteer (Chrome) for JS-rendered product descriptions.
 */
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

// Bypass self-signed cert issues in corporate/dev environments
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let browser;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--ignore-certificate-errors",
        "--disable-web-security",
      ],
    });
  }
  return browser;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// Catalog from the implementation plan — used as base + enriched with scraping
const PRODUCT_SEEDS = [
  { id: "hidow-spot",           name: "HiDow Spot",                    price: 119,       category: "wireless",      url: "/shop/hidow-spot/" },
  { id: "wireless-4-9",         name: "Wireless 4-9",                  price: 599,       category: "wireless",      url: "/shop/wireless-4-9/" },
  { id: "pro-touch-6-12",       name: "Pro Touch 6-12",                price: 999,       category: "wireless",      url: "/shop/pro-touch/",          badge: "best-seller" },
  { id: "wireless-receiver",    name: "Universal Wireless Receiver",   price: 99,        category: "wireless",      url: "/shop/wireless-receiver/" },
  { id: "xp-micro",             name: "XP Micro",                      price: 299,       category: "wired",         url: "/shop/acu-xp-micro/" },
  { id: "xpd-12",               name: "XPD 12",                        price: 399,       category: "wired",         url: "/shop/xpd-12/" },
  { id: "xpds-18",              name: "XPDS 18",                       price: 499,       category: "wired",         url: "/shop/xpds-18/" },
  { id: "xpds-4-24",            name: "XPDS 4-24",                     price: 649,       category: "wired",         url: "/shop/xpds-4-24/" },
  { id: "ocuwave",              name: "OcuWave Eye Massager",          price: 199,       category: "vibration",     url: "/shop/ocuwave-eye-massager/", priceRange: "$199–$249" },
  { id: "hd-mini2",             name: "HD Mini2 Massage Gun",          price: 299,       category: "percussion",    url: "/shop/hd-mini2/" },
  { id: "m3-mini3",             name: "M3 Mini3 Massage Gun",          price: 229,       category: "percussion",    url: "/shop/m3-mini-gun/" },
  { id: "thermoair-wave",       name: "ThermoAir Wave Compression 2.0", price: 35,      category: "percussion",    url: "/shop/thermoair-wave-compression-wraps/", priceRange: "$35–$479" },
  { id: "power-duo",            name: "Power Duo",                     price: 454,       category: "percussion",    url: "/shop/power-duo/" },
  { id: "acugloves",            name: "AcuGloves",                     price: 79,        category: "wraps",         url: "/shop/acugloves/",           priceRange: "$79–$159" },
  { id: "acuwrist-wrap",        name: "AcuWrist Wrap",                 price: 39,        category: "wraps",         url: "/shop/acuwrist-wrap/",       priceRange: "$39–$119" },
  { id: "acuelbow-wrap",        name: "AcuElbow Wrap",                 price: 49,        category: "wraps",         url: "/shop/acuelbow-wrap/",       priceRange: "$49–$129" },
  { id: "acuslippers",          name: "AcuSlippers",                   price: 49,        category: "wraps",         url: "/shop/electrotherapy-slippers/", priceRange: "$49–$129" },
  { id: "revive-head-wrap",     name: "Revive Head Wrap & Eye Mask",   price: 59,        category: "heat",          url: "/shop/revive-head-wrap-eye-mask/" },
  { id: "revive-gel-sleeve",    name: "Revive Hot & Cold Gel Sleeve",  price: 39,        category: "heat",          url: "/shop/revive-hot-cold-gel-sleeve/", priceRange: "$39–$124" },
  { id: "hd-glo",               name: "HD Glo Red Light Therapy Torch", price: 249,      category: "heat",          url: "/shop/hd-glo-red-light-therapy-torch/" },
  { id: "hot-cold-packs",       name: "Hot & Cold Therapy Packs",      price: 12,        category: "heat",          url: "/shop/hot-cold-therapy-packs-2-pack/", priceRange: "$12–$29" },
  { id: "hd-vibe",              name: "HD Vibe Roller",                 price: 99,        category: "vibration",     url: "/shop/hd-vibe-roller/" },
  { id: "triggerflex",          name: "TriggerFlex 2.0",               price: 50,        category: "vibration",     url: "/shop/triggerflex-2-0/" },
  { id: "perfect-conductor",    name: "Perfect Conductor Spray",       price: 19,        category: "accessories",   url: "/shop/perfect-conductor/",   badge: "best-seller" },
  { id: "magnesium-spray",      name: "Magnesium Spray",               price: 19,        category: "accessories",   url: "/shop/magnesium-spray/" },
  { id: "cervical-pads",        name: "Cervical Pads",                 price: 25,        category: "pads",          url: "/shop/cervical-pads/",       priceRange: "$25–$40" },
  { id: "dualpoint-pads",       name: "DualPoint Gel Pads",            price: 15,        category: "pads",          url: "/shop/dualpoint-gel-pads/",  priceRange: "$15–$50" },
  { id: "magnapads",            name: "MagnaPads",                     price: 35,        category: "pads",          url: "/shop/magna-pads/",          priceRange: "$35–$100" },
  { id: "heated-electrode-pad", name: "Heated Electrode Pad Set",      price: 59,        category: "pads",          url: "/shop/heated-electrode-pad-set/", priceRange: "$59–$99" },
  { id: "tactical-carry-bag",   name: "Tactical Carry Bag",            price: 29,        category: "organization",  url: "/shop/tactical-carry-bag/",  priceRange: "$29–$99" },
  { id: "tactical-backpack",    name: "Tactical Backpack",             price: 35,        category: "organization",  url: "/shop/tactical-backpack/" },
];

const CATEGORY_LABELS = {
  wireless:     "Wireless TENS/EMS Devices",
  wired:        "Wired TENS/EMS Devices",
  percussion:   "Percussion & Compression",
  vibration:    "Vibration Therapy",
  wraps:        "Electrotherapy Wraps",
  heat:         "Heat & Light Therapy",
  accessories:  "Accessories & Sprays",
  pads:         "Electrode Pads",
  organization: "Bags & Organization",
};

const PAIN_AREA_MAP = {
  wireless:   ["back", "neck", "shoulders", "arms", "legs", "full body"],
  wired:      ["back", "neck", "shoulders", "arms", "legs", "full body"],
  percussion: ["muscles", "back", "legs", "arms", "recovery"],
  vibration:  ["eyes", "muscles", "joints"],
  wraps:      ["hands", "wrists", "elbows", "feet"],
  heat:       ["head", "eyes", "joints", "muscles"],
  accessories:["general"],
  pads:       ["neck", "back", "joints"],
  organization:["general"],
};

async function fetchProductDescription(url) {
  try {
    const BASE = "https://www.hidow.com";
    const br = await getBrowser();
    const page = await br.newPage();

    await page.setUserAgent(HEADERS["User-Agent"]);
    await page.setExtraHTTPHeaders({ "Accept-Language": HEADERS["Accept-Language"] });

    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Wait briefly for JS to render content
    await new Promise(r => setTimeout(r, 1500));

    const { desc, image } = await page.evaluate(() => {
      // Description
      const descSelectors = [
        ".woocommerce-product-details__short-description p",
        ".woocommerce-product-details__short-description",
        ".entry-summary > p",
        ".product-short-description p",
        '[class*="short-description"] p',
        ".woocommerce-tabs .panel p",
      ];
      let desc = "";
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim().length > 30) { desc = el.textContent.trim(); break; }
      }

      // Image (og:image → first product gallery image)
      const og = document.querySelector('meta[property="og:image"]')?.content;
      const gallery = document.querySelector(".woocommerce-product-gallery__image img")?.src
        || document.querySelector(".wp-post-image")?.src;
      const image = og || gallery || "";

      return { desc, image };
    });

    await page.close();
    return { description: desc.slice(0, 400), image };
  } catch {
    return "";
  }
}

async function scrapeFAQs() {
  console.log("📖 Scraping FAQs from hidow.com/faq/ ...");
  try {
    const { data } = await axios.get("https://www.hidow.com/faq/", {
      headers: HEADERS,
      timeout: 15000,
      httpsAgent,
    });
    const $ = cheerio.load(data);
    const faqs = [];

    // WooCommerce FAQ / accordion selectors — try several patterns
    const candidates = [
      ".faq-item", ".accordion-item", ".et_pb_toggle",
      ".elementor-toggle-item", "[class*='faq']", "details",
    ];

    let found = false;
    for (const sel of candidates) {
      const items = $(sel);
      if (items.length > 2) {
        items.each((i, el) => {
          const q =
            $(el).find("h3, h4, .faq-question, summary, .et_pb_toggle_title, .elementor-tab-title").first().text().trim() ||
            $(el).children().first().text().trim();
          const a =
            $(el).find(".faq-answer, .et_pb_toggle_content, .elementor-tab-content, p").first().text().trim() ||
            $(el).children().last().text().trim();

          if (q && a && q !== a) {
            faqs.push({
              id: `faq-${i + 1}`,
              question_en: q,
              answer_en: a.slice(0, 600),
              tags: ["general"],
            });
          }
        });
        if (faqs.length > 0) { found = true; break; }
      }
    }

    if (!found || faqs.length === 0) {
      console.log("  ⚠️  Could not parse FAQs from live page — using built-in FAQ data");
      return getBuiltInFAQs();
    }

    console.log(`  ✅ Scraped ${faqs.length} FAQs`);
    return faqs;
  } catch (err) {
    console.log(`  ⚠️  FAQ scrape failed (${err.message}) — using built-in FAQ data`);
    return getBuiltInFAQs();
  }
}

function getBuiltInFAQs() {
  return [
    {
      id: "what-is-tens",
      question_en: "What is TENS?",
      question_es: "¿Qué es TENS?",
      answer_en: "Transcutaneous Electrical Nerve Stimulation (TENS) uses low-voltage electrical current to stimulate sensory nerves and suppress pain signals sent to the brain. It is widely used for pain management and is cleared by the FDA for OTC use.",
      answer_es: "La Estimulación Eléctrica Transcutánea (TENS) usa corriente eléctrica de bajo voltaje para estimular los nervios sensoriales y suprimir las señales de dolor enviadas al cerebro. Es ampliamente usada para el manejo del dolor y está aprobada por la FDA para uso sin prescripción.",
      tags: ["tens", "technology", "basics"],
    },
    {
      id: "what-is-ems",
      question_en: "What is EMS?",
      question_es: "¿Qué es EMS?",
      answer_en: "Electrical Muscle Stimulation (EMS) sends electrical pulses directly to the muscles, causing them to contract. It is used for muscle strengthening, rehabilitation, and recovery by athletes and physical therapists.",
      answer_es: "La Estimulación Muscular Eléctrica (EMS) envía pulsos eléctricos directamente a los músculos, causando su contracción. Se usa para fortalecer músculos, rehabilitación y recuperación.",
      tags: ["ems", "technology", "basics"],
    },
    {
      id: "what-is-microcurrent",
      question_en: "What is Microcurrent therapy?",
      question_es: "¿Qué es la terapia de Microcorriente?",
      answer_en: "Microcurrent therapy uses extremely low-level electrical current (millionths of an amp) that mimics the body's natural bioelectric signals. It promotes cellular repair, reduces inflammation, and accelerates healing at the cellular level.",
      answer_es: "La terapia de microcorriente usa corriente eléctrica de nivel extremadamente bajo (millonésimas de amperio) que imita las señales bioeléctricas naturales del cuerpo, promoviendo la reparación celular y reduciendo la inflamación.",
      tags: ["microcurrent", "technology"],
    },
    {
      id: "is-it-safe",
      question_en: "Are HiDow devices safe?",
      question_es: "¿Son seguros los dispositivos HiDow?",
      answer_en: "Yes. HiDow devices are FDA-cleared for OTC (over-the-counter) use. They are safe for most adults. However, they should NOT be used by people with pacemakers, during pregnancy, by epileptics, or on areas with broken skin or cancer.",
      answer_es: "Sí. Los dispositivos HiDow están aprobados por la FDA para uso sin prescripción. Sin embargo, NO deben ser usados por personas con marcapasos, durante el embarazo, por epilépticos, ni en áreas con piel lesionada o cáncer.",
      tags: ["safety", "fda", "pacemaker"],
    },
    {
      id: "pacemaker",
      question_en: "Can I use TENS if I have a pacemaker?",
      question_es: "¿Puedo usar TENS si tengo marcapasos?",
      answer_en: "No. People with pacemakers, implanted defibrillators, or any electronic implant should NOT use TENS or EMS devices, as the electrical signals may interfere with the implant. Please consult your physician.",
      answer_es: "No. Las personas con marcapasos, desfibriladores implantados o cualquier implante electrónico NO deben usar dispositivos TENS o EMS, ya que las señales eléctricas pueden interferir con el implante. Consulte a su médico.",
      tags: ["safety", "pacemaker", "contraindication"],
    },
    {
      id: "how-to-use",
      question_en: "How do I use a HiDow device?",
      question_es: "¿Cómo uso un dispositivo HiDow?",
      answer_en: "1. Apply electrode pads to clean, dry skin near the pain area. 2. Connect pads to the device. 3. Turn on the device and start at the lowest intensity. 4. Gradually increase to a comfortable level. 5. Use for 15–30 minutes per session. Always refer to the product manual.",
      answer_es: "1. Coloque los electrodos en piel limpia y seca cerca del área de dolor. 2. Conéctelos al dispositivo. 3. Enciéndalo comenzando en la intensidad más baja. 4. Aumente gradualmente a un nivel cómodo. 5. Use 15–30 minutos por sesión.",
      tags: ["usage", "how-to", "electrode pads"],
    },
    {
      id: "wireless-vs-wired",
      question_en: "What is the difference between wireless and wired devices?",
      question_es: "¿Cuál es la diferencia entre dispositivos inalámbricos y con cable?",
      answer_en: "Wireless devices (like the Pro Touch 6-12 and Wireless 4-9) have no cables between the controller and electrode pads — the signal is transmitted wirelessly to receivers on the body. Wired devices connect pads via leads. Wireless offers more freedom of movement.",
      answer_es: "Los dispositivos inalámbricos (como el Pro Touch 6-12 y Wireless 4-9) no tienen cables entre el controlador y los electrodos — la señal se transmite inalámbricamente a receptores en el cuerpo. Los cableados conectan los electrodos mediante cables. Lo inalámbrico da más libertad de movimiento.",
      tags: ["wireless", "wired", "comparison"],
    },
    {
      id: "how-long-sessions",
      question_en: "How long should a TENS session last?",
      question_es: "¿Cuánto debe durar una sesión de TENS?",
      answer_en: "Typical sessions last 15 to 30 minutes. Most devices have built-in timers. You can do multiple sessions per day with at least 20 minutes of rest between them. Prolonged use on a single session (over 45 min) is not recommended.",
      answer_es: "Las sesiones típicas duran de 15 a 30 minutos. La mayoría de los dispositivos tienen temporizador integrado. Puedes hacer varias sesiones al día con al menos 20 minutos de descanso entre ellas.",
      tags: ["usage", "duration", "sessions"],
    },
    {
      id: "gel-pads-replacement",
      question_en: "When should I replace the electrode pads?",
      question_es: "¿Cuándo debo reemplazar los electrodos?",
      answer_en: "Replace electrode pads when they lose their stickiness (usually after 20–30 uses). You can extend their life by cleaning them with a damp cloth and storing them on their plastic backing. HiDow's Perfect Conductor Spray improves conductivity and extends pad life.",
      answer_es: "Reemplaza los electrodos cuando pierdan su adherencia (generalmente después de 20–30 usos). Puedes extender su vida limpiándolos con un paño húmedo. El Perfect Conductor Spray de HiDow mejora la conductividad y extiende la vida de los electrodos.",
      tags: ["pads", "maintenance", "accessories"],
    },
    {
      id: "pain-types",
      question_en: "What types of pain can TENS help with?",
      question_es: "¿Para qué tipos de dolor sirve el TENS?",
      answer_en: "TENS is commonly used for: chronic back pain, neck and shoulder pain, arthritis, sciatica, fibromyalgia, sports injuries, post-surgical pain, and menstrual cramps. It is most effective for localized, chronic, or musculoskeletal pain.",
      answer_es: "El TENS se usa comúnmente para: dolor crónico de espalda, dolor de cuello y hombros, artritis, ciática, fibromialgia, lesiones deportivas, dolor posquirúrgico y cólicos menstruales.",
      tags: ["pain", "conditions", "use-cases"],
    },
    {
      id: "where-to-place-pads",
      question_en: "Where should I place the electrode pads?",
      question_es: "¿Dónde debo colocar los electrodos?",
      answer_en: "Place pads on either side of the pain area (not directly over the spine). Common placements: lower back sides, shoulders, thighs, calves, and forearms. NEVER place on the head, over the heart, throat, or on broken/irritated skin.",
      answer_es: "Coloca los electrodos a ambos lados del área de dolor (nunca directamente sobre la columna). Nunca los pongas en la cabeza, sobre el corazón, la garganta, o en piel irritada.",
      tags: ["pads", "placement", "how-to"],
    },
    {
      id: "warranty",
      question_en: "What is the warranty on HiDow devices?",
      question_es: "¿Cuál es la garantía de los dispositivos HiDow?",
      answer_en: "HiDow devices come with a manufacturer's warranty. Specific warranty periods vary by product. Please contact HiDow customer support at (314) 569-2888 or visit hidow.com/contact-us for warranty details on a specific product.",
      answer_es: "Los dispositivos HiDow incluyen garantía del fabricante. Los períodos varían por producto. Contacta al soporte de HiDow al (314) 569-2888 o visita hidow.com/contact-us para detalles.",
      tags: ["warranty", "support"],
    },
    {
      id: "shipping",
      question_en: "How long does shipping take?",
      question_es: "¿Cuánto tarda el envío?",
      answer_en: "Shipping times vary depending on your location and selected shipping method. For current shipping options, rates, and timelines, please contact HiDow directly at (314) 569-2888 or visit hidow.com.",
      answer_es: "Los tiempos de envío varían según tu ubicación y método de envío seleccionado. Para opciones actuales, contacta a HiDow al (314) 569-2888 o visita hidow.com.",
      tags: ["shipping", "delivery"],
    },
    {
      id: "returns",
      question_en: "What is the return policy?",
      question_es: "¿Cuál es la política de devoluciones?",
      answer_en: "HiDow has a return policy for products in original condition. For full details on returns and exchanges, please contact customer support at (314) 569-2888 or hidow.com/contact-us.",
      answer_es: "HiDow tiene una política de devoluciones para productos en condición original. Para detalles completos, contacta al soporte al (314) 569-2888 o hidow.com/contact-us.",
      tags: ["returns", "policy"],
    },
    {
      id: "pregnancy",
      question_en: "Can I use TENS during pregnancy?",
      question_es: "¿Puedo usar TENS durante el embarazo?",
      answer_en: "TENS should generally NOT be used during pregnancy without physician approval. Some uses (like TENS for labor pain) exist under medical supervision, but self-administered use is not recommended. Always consult your OB/GYN first.",
      answer_es: "El TENS generalmente NO debe usarse durante el embarazo sin aprobación médica. Consulta siempre a tu ginecólogo antes de usar cualquier dispositivo de electroestimulación.",
      tags: ["safety", "pregnancy", "contraindication"],
    },
    {
      id: "difference-tens-ems",
      question_en: "What is the difference between TENS and EMS?",
      question_es: "¿Cuál es la diferencia entre TENS y EMS?",
      answer_en: "TENS targets sensory nerves to block pain signals. EMS targets motor nerves to stimulate muscle contractions. HiDow's combo devices (like the Pro Touch 6-12) offer both TENS and EMS modes, giving you pain relief AND muscle conditioning in one device.",
      answer_es: "TENS actúa sobre los nervios sensoriales para bloquear señales de dolor. EMS actúa sobre los nervios motores para estimular contracciones musculares. Los dispositivos combinados de HiDow (como el Pro Touch 6-12) ofrecen ambos modos.",
      tags: ["tens", "ems", "comparison"],
    },
  ];
}

async function buildProductsData() {
  console.log("🛍️  Building product catalog...");
  const products = [];

  for (const seed of PRODUCT_SEEDS) {
    process.stdout.write(`  → ${seed.name}... `);

    let description = "";
    let image = "";
    try {
      const result = await fetchProductDescription(seed.url);
      description = result.description || "";
      image = result.image || "";
      if (description) process.stdout.write("scraped ✓\n");
      else process.stdout.write("no description\n");
    } catch {
      process.stdout.write("error\n");
    }

    products.push({
      id: seed.id,
      name: seed.name,
      category: seed.category,
      categoryLabel: CATEGORY_LABELS[seed.category] || seed.category,
      price: seed.price,
      priceDisplay: seed.priceRange || `$${seed.price}`,
      url: `https://www.hidow.com${seed.url}`,
      description,
      image,
      badge: seed.badge || null,
      pain_areas: PAIN_AREA_MAP[seed.category] || ["general"],
    });

    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  return products;
}

async function main() {
  console.log("\n🚀 HiDow Knowledge Base Scraper\n");
  mkdirSync(DATA_DIR, { recursive: true });

  const [products, faqs] = await Promise.all([
    buildProductsData(),
    scrapeFAQs(),
  ]);

  writeFileSync(
    resolve(DATA_DIR, "products.json"),
    JSON.stringify({ products }, null, 2),
    "utf8"
  );
  console.log(`\n✅ data/products.json — ${products.length} products`);

  writeFileSync(
    resolve(DATA_DIR, "faq.json"),
    JSON.stringify({ faqs }, null, 2),
    "utf8"
  );
  console.log(`✅ data/faq.json — ${faqs.length} FAQs`);

  if (browser) await browser.close();
  console.log("\n🎉 Knowledge base ready. Run: npm start\n");
}

main().catch(async (err) => {
  if (browser) await browser.close();
  console.error("Scrape failed:", err);
  process.exit(1);
});
