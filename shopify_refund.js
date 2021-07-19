const axios = require("axios");

module.exports = {
  name: "Shopify Refund",
  description:
    "This action uses the Firmhouse API to refund a payment based on a cancelled or refunded Shopify order",
  key: "shopify_refund",
  version: "0.0.24",
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
    const firmhouseQuery = async (query, headers = {}) => {
      headers = Object.assign(
        {
          "Content-Type": "application/json",
          "X-Project-Access-Token": this.projectAccessToken,
        },
        headers
      );
      return axios({
        method: "POST",
        url: `https://portal.firmhouse.com/graphql`,
        headers: headers,
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
              token
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

    this.body.refund_line_items.forEach(async (refundLineItem) => {
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

        const orderedProductUpdate = await firmhouseQuery(
          `mutation {
            updateOrderedProduct(input: {
              id: ${orderedProduct.id}
              quantity: ${newQuantity}
            }) {
              orderedProduct {
                id
                quantity
              }
              errors {
                attribute
                message
              }
            }
          }`
        );

        const orderedProductUpdateErrors =
          orderedProductUpdate.data.data.updateOrderedProduct.errors;

        if (orderedProductUpdateErrors) {
          console.log(`Error ${orderedProductUpdateErrors}`);
        } else {
          console.log(
            `Done! Updated ordered product #${orderedProductUpdate.id} to quantity ${newQuantity}`
          );
        }
      } else {
        console.log(`Removing ordered product ${orderedProduct.id}`);
        const orderedProductDestroy = await firmhouseQuery(
          `
        mutation {
          destroyOrderedProduct(input: { id: ${orderedProduct.id} }) {
            subscription {
              token
            }
          }
        }
        `,
          { "X-Subscription-Token": order.subscription.token }
        );
        console.log(`Removed ordered product ${orderedProduct.id}`);
        console.log(orderedProductDestroy);
      }

      refundAmount +=
        orderedProduct.priceIncludingTaxCents * refundLineItem.quantity;
    });

    refundAmount = refundAmount / 100;

    console.log(
      `Will create refund here for ${payment.id} for € ${refundAmount}`
    );

    const refund = await firmhouseQuery(
      `mutation {
        refundPayment(input: {
          id: ${payment.id},
          amount: ${refundAmount}
        }) {
          payment {
            token
            status
          }
          refund {
            id
            status
          }
          errors {
            path
            message
            attribute
          }
        }
      }`
    );

    const refundErrors = refund.data.data.refundPayment.errors;

    if (refundErrors) {
      console.log(`
        Error: ${refundErrors}
      `);
      return;
    } else {
      console.log(`
        Refund created for ${payment.id}
      `);
    }
  },
};
