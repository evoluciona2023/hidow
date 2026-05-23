import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Bypass corporate SSL inspection in dev/on-prem environments
    rejectUnauthorized: false,
  },
});

export async function sendOrderConfirmationEmail(order) {
  const {
    orderRef,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    order_items,
    order_total,
    language = "en",
  } = order;

  const es = language === "es";

  const refLabel = orderRef ? ` · Ref: ${orderRef}` : "";
  const subject = es
    ? `✅ Confirmación de pedido — HiDow International${refLabel}`
    : `✅ Order Confirmation — HiDow International${refLabel}`;

  const itemRows = order_items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">${item.product_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">$${item.price.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="${es ? "es" : "en"}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:28px 32px;text-align:center">
            <img src="https://www.hidow.com/wp-content/uploads/2024/04/HiDow-International-Black-Logo.svg"
                 alt="HiDow International" height="40"
                 style="filter:invert(1);display:block;margin:0 auto"/>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;text-align:center">
            <div style="font-size:48px">✅</div>
            <h1 style="margin:12px 0 8px;font-size:22px;color:#1a1a2e">
              ${es ? "¡Gracias por tu pedido!" : "Thank you for your order!"}
            </h1>
            <p style="margin:0;color:#555;font-size:15px">
              ${es
                ? `Hola <strong>${customer_name}</strong>, recibimos tu solicitud.`
                : `Hello <strong>${customer_name}</strong>, we received your order request.`}
            </p>
            ${orderRef ? `<p style="margin:8px 0 0;font-size:13px;color:#888">${es ? "Referencia" : "Order Ref"}: <strong style="color:#1a1a2e">${orderRef}</strong></p>` : ""}
          </td>
        </tr>

        <!-- Notice -->
        <tr>
          <td style="padding:0 32px 24px">
            <div style="background:#f0f7ff;border-left:4px solid #2563eb;border-radius:4px;padding:14px 18px;
                        color:#1e40af;font-size:14px;line-height:1.6">
              ${es
                ? "Un representante de HiDow te contactará pronto para procesar el pago y coordinar el envío."
                : "A HiDow representative will contact you shortly to process payment and arrange shipping."}
            </div>
          </td>
        </tr>

        <!-- Order Summary -->
        <tr>
          <td style="padding:0 32px 24px">
            <h2 style="font-size:16px;color:#1a1a2e;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #eee">
              ${es ? "Resumen del pedido" : "Order Summary"}
            </h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <thead>
                <tr style="background:#f8f9fa">
                  <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600">
                    ${es ? "Producto" : "Product"}
                  </th>
                  <th style="padding:10px 12px;text-align:center;font-size:13px;color:#666;font-weight:600">
                    ${es ? "Cant." : "Qty"}
                  </th>
                  <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;font-weight:600">
                    ${es ? "Precio" : "Price"}
                  </th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
              <tfoot>
                <tr style="background:#f8f9fa">
                  <td colspan="2" style="padding:12px;font-weight:700;font-size:15px;color:#1a1a2e">
                    Total
                  </td>
                  <td style="padding:12px;font-weight:700;font-size:15px;color:#1a1a2e;text-align:right">
                    $${order_total.toFixed(2)} USD
                  </td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr>

        <!-- Shipping Info -->
        <tr>
          <td style="padding:0 32px 24px">
            <h2 style="font-size:16px;color:#1a1a2e;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #eee">
              ${es ? "Datos de envío" : "Shipping Details"}
            </h2>
            <p style="margin:0 0 6px;color:#444;font-size:14px">
              <strong>${es ? "Dirección" : "Address"}:</strong><br/>
              ${shipping_address}
            </p>
            ${customer_phone
              ? `<p style="margin:8px 0 0;color:#444;font-size:14px">
                   <strong>${es ? "Teléfono" : "Phone"}:</strong> ${customer_phone}
                 </p>`
              : ""}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 32px;text-align:center;border-top:1px solid #eee">
            <p style="margin:0 0 4px;color:#888;font-size:12px">
              HiDow International · 2555 Metro Blvd, Maryland Heights, MO 63043
            </p>
            <p style="margin:0;color:#888;font-size:12px">
              <a href="tel:3145692888" style="color:#2563eb;text-decoration:none">(314) 569-2888</a>
              &nbsp;·&nbsp;
              <a href="https://www.hidow.com" style="color:#2563eb;text-decoration:none">hidow.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"HiDow International" <${process.env.SMTP_FROM}>`,
      to: customer_email,
      bcc: process.env.ORDERS_BCC_EMAIL || undefined,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    logger.error("Order email failed", { error: error.message, to: customer_email });
    return { success: false, error: error.message };
  }
}

// ── Abandoned purchase email ───────────────────────────────────────
export async function sendAbandonmentEmail({ email, name, language, cartData }) {
  const es = language === "es";
  const productList = Array.isArray(cartData)
    ? cartData.map(i => `<li>${i.product_name || i} — $${i.price?.toFixed(2) || ""}</li>`).join("")
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <div style="background:#1a1a2e;padding:24px;text-align:center;border-radius:8px 8px 0 0">
        <img src="https://www.hidow.com/wp-content/uploads/2024/04/HiDow-International-Black-Logo.svg"
             alt="HiDow" height="36" style="filter:invert(1)"/>
      </div>
      <div style="background:white;padding:28px;border:1px solid #eee;border-radius:0 0 8px 8px">
        <h2 style="color:#1a1a2e;margin:0 0 12px">
          ${es ? `Hola ${name || ""}, ¿olvidaste algo?` : `Hey ${name || ""}, you left something behind!`}
        </h2>
        <p style="color:#444;line-height:1.6">
          ${es
            ? "Notamos que estabas explorando nuestros dispositivos de terapia TENS/EMS. ¿Podemos ayudarte a completar tu pedido?"
            : "We noticed you were exploring our TENS/EMS therapy devices. Can we help you complete your order?"}
        </p>
        ${productList ? `
          <div style="background:#f8f9fa;border-radius:6px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 10px;font-size:14px;color:#1a1a2e">${es ? "Tu selección:" : "Your selection:"}</h3>
            <ul style="margin:0;padding-left:20px;color:#444;font-size:14px">${productList}</ul>
          </div>` : ""}
        <div style="background:#f0f7ff;border-left:4px solid #2563eb;border-radius:4px;padding:14px;margin:16px 0">
          <strong style="color:#1e40af">
            ${es ? "🎁 Usa el código HIDOW10 para 10% de descuento en tu primer pedido" : "🎁 Use code HIDOW10 for 10% off your first order"}
          </strong>
        </div>
        <p style="text-align:center;margin:20px 0 8px">
          <a href="https://hidow-production.up.railway.app/shop.html"
             style="background:#2563eb;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            ${es ? "Continuar comprando →" : "Continue Shopping →"}
          </a>
        </p>
        <p style="color:#888;font-size:13px;text-align:center;margin-top:16px">
          ${es ? "¿Preguntas? Llámanos:" : "Questions? Call us:"} <a href="tel:3145692888" style="color:#2563eb">(314) 569-2888</a>
        </p>
        <p style="color:#bbb;font-size:11px;text-align:center;margin-top:12px">
          HiDow International · <a href="https://www.hidow.com" style="color:#bbb">hidow.com</a>
        </p>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from: `"HiDow International" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: es ? "¿Olvidaste completar tu pedido? 🛒" : "Did you forget something? 🛒",
      html,
    });
    logger.info("Abandonment email sent", { email });
    return { success: true };
  } catch (error) {
    logger.error("Abandonment email failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

// ── Lead capture notification ──────────────────────────────────────
export async function sendLeadCaptureEmail({ name, email, interests, language }) {
  const es = language === "es";
  try {
    await transporter.sendMail({
      from: `"HiDow Agent" <${process.env.SMTP_FROM}>`,
      to: process.env.ORDERS_BCC_EMAIL || process.env.SMTP_FROM,
      subject: es ? `🎯 Nuevo lead capturado — ${name}` : `🎯 New lead captured — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#1a1a2e">🎯 ${es ? "Nuevo lead" : "New lead"}</h2>
          <table style="width:100%;font-size:14px">
            <tr><td style="padding:6px 0"><strong>${es ? "Nombre" : "Name"}:</strong></td><td>${name}</td></tr>
            <tr><td style="padding:6px 0"><strong>Email:</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:6px 0"><strong>${es ? "Idioma" : "Language"}:</strong></td><td>${es ? "Español 🇪🇸" : "English 🇺🇸"}</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top"><strong>${es ? "Interesado en" : "Interested in"}:</strong></td><td>${interests}</td></tr>
          </table>
          <p style="margin-top:16px;color:#888;font-size:12px">HiDow International · hidow.com</p>
        </div>`,
    });
    logger.info("Lead capture email sent", { email });
    return { success: true };
  } catch (error) {
    logger.error("Lead capture email failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

// ── Human handoff notification ─────────────────────────────────────
export async function sendHumanHandoffEmail({ reason, conversation_summary, user_language }, messages = []) {
  const isEs = user_language === "es";
  const subject = isEs
    ? "🚨 Cliente solicita agente humano — HiDow"
    : "🚨 Customer requests human agent — HiDow";

  const conversationHtml = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const label = m.role === "user" ? "👤 Customer" : "🤖 Agent";
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `<div style="margin:8px 0;padding:8px 12px;background:${m.role === "user" ? "#f0f2f5" : "#fff"};border-radius:6px">
        <strong>${label}:</strong> ${content.slice(0, 500)}
      </div>`;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">🚨 Human Agent Request</h2>
      </div>
      <div style="background:white;padding:24px;border:1px solid #eee;border-radius:0 0 8px 8px">
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Summary:</strong> ${conversation_summary}</p>
        <p><strong>Language:</strong> ${user_language === "es" ? "Spanish 🇪🇸" : "English 🇺🇸"}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
        <h3>Conversation History</h3>
        ${conversationHtml || "<p>No history available</p>"}
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
        <p style="color:#888;font-size:12px">HiDow International · (314) 569-2888 · hidow.com</p>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from: `"HiDow Agent" <${process.env.SMTP_FROM}>`,
      to: process.env.ORDERS_BCC_EMAIL || process.env.SMTP_FROM,
      subject,
      html,
    });
    logger.info("Handoff email sent", { reason });
    return { success: true };
  } catch (error) {
    logger.error("Handoff email failed", { error: error.message });
    return { success: false, error: error.message };
  }
}
