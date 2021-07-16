const axios = require("axios");

module.exports = {
  name: "Shopify Refund",
  description:
    "This action uses the Firmhouse API to refund a payment based on a cancelled or refunded Shopify order",
  key: "shopify_refund",
  version: "0.0.20",
  type: "action",
  props: {
    body: {
      label: "body (set {{event.body}} with structured mode disabled)",
      type: "object",
    },
    projectAccessToken: {
      label: "Firmhouse project access token (write)",
      type: "string",
    },
  },
  async run() {
    const firmhouseQuery = async (query) => {
      return axios({
        method: "POST",
        url: `https://portal.firmhouse.com/graphql`,
        headers: {
          "Content-Type": "application/json",
          "X-Project-Access-Token": this.projectAccessToken,
        },
        data: JSON.stringify({ query: query }),
      });
    };

    const firmhouseOrder = await firmhouseQuery(`
        query {
          getOrderBy(shopifyId: "gid://shopify/Order/${this.body.order_id}") {
            id
            payment {
              token
            }
            subscription {
              id
              orderedProducts {
                id
                quantity
                priceIncludingTaxCents
                product {
                  shopifyVariantId
                }
              }
            }
          }
        }
    `);

    const order = firmhouseOrder.data.data.getOrderBy;
    if (!order) return "No order found for incoming message.";

    const payment = order.payment;
    if (!payment) return "No payment found to make the refund on.";

    const findOrderedProduct = (shopifyVariantId) => {
      return order.subscription.orderedProducts.find(
        (o) => o.product.shopifyVariantId == shopifyVariantId
      );
    };

    var refundAmount = 0;

    this.body.refund_line_items.forEach((refundLineItem) => {
      const orderedProduct = findOrderedProduct(
        `gid://shopify/ProductVariant/${refundLineItem.line_item.variant_id}`
      );

      if (!orderedProduct) {
        console.log(
          `Ordered product not found for ${refundLineItem.line_item.variant_id}`
        );
        return;
      }

      const newQuantity = orderedProduct.quantity - refundLineItem.quantity;

      if (newQuantity > 0) {
        console.log(`Updating quantity for ${orderedProduct.id}`);
        console.log(`Set quantity ${newQuantity}`);
      } else {
        console.log(`Removing ordered product ${orderedProduct.id}`);
      }

      refundAmount +=
        orderedProduct.priceIncludingTaxCents * refundLineItem.quantity;
    });

    console.log(
      `Will create refund here for ${payment.id} for € ${refundAmount / 100}`
    );
  },
};
