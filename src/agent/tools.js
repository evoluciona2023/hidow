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
          order_total: { type: "number" },
          language:    { type: "string", enum: ["en", "es"] },
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
        "Use after 3+ exchanges where the user has asked about products but hasn't started a purchase. " +
        "Offer to send them information first — only call if they agree.",
      parameters: {
        type: "object",
        properties: {
          name:      { type: "string",  description: "Customer name if known, else 'Unknown'" },
          email:     { type: "string",  description: "Customer email address" },
          interests: { type: "string",  description: "Products or conditions they asked about" },
          language:  { type: "string",  enum: ["en", "es"] },
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
        "or the question involves custom pricing, bulk orders, or medical advice.",
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
];
