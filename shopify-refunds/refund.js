module.exports = {
  name: "Shopify Refund",
  description:
    "This action uses the Firmhouse API to refund a payment based on a cancelled or refunded Shopify order",
  key: "shopify_refund",
  version: "0.0.1",
  type: "action",
  props: {},
  async run() {
    return `hello world!`;
  },
};
