const crypto = require("crypto");

module.exports = {
  name: "Shopify Webhook Integrity",
  description:
    "This action verifies that the webhook request actually comes from Shopify",
  key: "shopify_webhook_integrity",
  version: "0.0.9",
  type: "action",
  props: {
    shopifySignature: {
      label: "Shopify webhook secret",
      type: "string",
      description: "Generic webhook signing secret provided by Shopify",
    },
    shopifyHeader: {
      label: "Shopify sha256 MAC header",
      type: "object",
      description:
        'Generally, you can use {{event.headers["x-shopify-hmac-sha256"]}} here.',
    },
    requestBodyRaw: {
      label: "Request body to verify",
      type: "object",
      description:
        "The raw body of the request used to generate the hash digest. Use: {{event.bodyRaw}}",
    },
  },
  async run() {
    const generatedHash = crypto
      .createHmac("sha256", this.shopifySignature)
      .update(this.requestBodyRaw)
      .digest("base64");

    if (this.shopifyHeader !== generatedHash) {
      throw "Invalid Shopify signature.";
    }

    return true;
  },
};
