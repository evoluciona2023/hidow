export const tools = [
  {
    type: "function",
    function: {
      name: "send_order_confirmation",
      description:
        "Sends an order confirmation email to the customer. " +
        "Only call this AFTER the user explicitly confirms they want the email sent.",
      parameters: {
        type: "object",
        properties: {
          customer_name:    { type: "string" },
          customer_email:   { type: "string" },
          customer_phone:   { type: "string" },
          shipping_address: { type: "string" },
          order_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                price:        { type: "number" },
                quantity:     { type: "integer" },
              },
              required: ["product_name", "price", "quantity"],
            },
          },
          order_total:    { type: "number" },
          discount_code:  { type: "string", description: "Applied discount code if any" },
          discount_amount:{ type: "number", description: "Dollar amount discounted" },
          language:       { type: "string", enum: ["en", "es"] },
        },
        required: ["customer_name", "customer_email", "shipping_address", "order_items", "order_total", "language"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_lead",
      description:
        "Captures a potential customer's email when they show interest but are not ready to buy. " +
        "Use after 3+ exchanges where the user asked about products but hasn't started a purchase. " +
        "Offer to send them information first — only call if they agree.",
      parameters: {
        type: "object",
        properties: {
          name:      { type: "string" },
          email:     { type: "string" },
          interests: { type: "string" },
          language:  { type: "string", enum: ["en", "es"] },
        },
        required: ["name", "email", "interests", "language"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_agent",
      description:
        "Transfer the user to a human HiDow representative. " +
        "Use when: the user explicitly asks for a human, you cannot resolve the issue after 2 attempts, " +
        "the user seems frustrated, or the question involves custom pricing, bulk orders, or medical advice.",
      parameters: {
        type: "object",
        properties: {
          reason:               { type: "string" },
          conversation_summary: { type: "string" },
          user_language:        { type: "string", enum: ["en", "es"] },
        },
        required: ["reason", "conversation_summary", "user_language"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_products",
      description:
        "Generate a side-by-side comparison table of two HiDow products. " +
        "Use when the user asks 'which is better', 'what's the difference', or 'compare X vs Y'.",
      parameters: {
        type: "object",
        properties: {
          product_a: { type: "string", description: "First product name or ID" },
          product_b: { type: "string", description: "Second product name or ID" },
        },
        required: ["product_a", "product_b"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_discount_code",
      description:
        "Validate and apply a discount code to the current order. " +
        "Call when the user provides a promo or discount code.",
      parameters: {
        type: "object",
        properties: {
          code:        { type: "string", description: "The discount code provided by the user" },
          order_total: { type: "number", description: "Current order total before discount" },
        },
        required: ["code", "order_total"],
      },
    },
  },
];
