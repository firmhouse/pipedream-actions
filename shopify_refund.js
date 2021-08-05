const axios = require("axios");

module.exports = {
  name: "Shopify Refund",
  description:
    "This action uses the Firmhouse API to refund a payment based on a cancelled or refunded Shopify order",
  key: "shopify_refund",
  version: "0.0.47",
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
    const shopifyRefund = new ShopifyRefund(this.projectAccessToken, this.body);
    return await shopifyRefund.perform();
  },
};

class ShopifyRefund {
  constructor(projectAccessToken, body) {
    this.projectAccessToken = projectAccessToken;
    this.body = body;
  }

  async perform() {
    await this.ensureOrder();

    if (!this.firmhouseOrder) return "No order found for incoming message.";

    this.subscriptionToken = this.firmhouseOrder.subscription.token;
    this.firmhousePayment = this.firmhouseOrder.payment;

    if (!this.firmhousePayment) return "No payment found to refund.";

    await this.updateOrderedProducts();
    await this.performRefund();
    await this.cancelSubscription();
  }

  async cancelSubscription() {
    const firmhouseSubscriptionQuery = await this.firmhouseQuery(`
        query {
          getSubscription(token: "${this.subscriptionToken}") {
            orderedProducts {
              id
            }
          }
        }
    `);

    const orderedProducts =
      firmhouseSubscriptionQuery.data.data.getSubscription.orderedProducts;

    if (orderedProducts.length > 0) return;

    await this.firmhouseQuery(`
        mutation {
          cancelSubscription(
            input: {
              token: "${this.subscriptionToken}",
              cancellationNotes: "Cancellation triggered by Shopify refund"
            }
          ) {
            subscription {
              status
            }
          }
        }
    `);
  }

  async updateOrderedProducts() {
    for (const refundLineItem of this.body.refund_line_items) {
      const orderedProduct = this.findOrderedProduct(
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

        const orderedProductUpdate = await this.firmhouseQuery(
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

        const orderedProductUpdateErrors = orderedProductUpdate.data.errors;

        if (orderedProductUpdateErrors) {
          console.log(`Error ${JSON.stringify(orderedProductUpdateErrors)}`);
          return;
        } else {
          console.log(
            `Updated ordered product #${orderedProductUpdate.id} to quantity ${newQuantity}`
          );
        }
      } else {
        console.log(`Removing ordered product ${orderedProduct.id}`);
        const orderedProductDestroy = await this.firmhouseQuery(
          `
      mutation {
        destroyOrderedProduct(input: { id: ${orderedProduct.id} }) {
          subscription {
            token
          }
        }
      }
      `
        );
        console.log(`Removed ordered product ${orderedProduct.id}`);
        console.log(orderedProductDestroy);
      }
    }
  }

  async performRefund() {
    console.log(
      `Will create refund here for ${this.firmhousePayment.id} for € ${this.refundAmount}`
    );

    const refund = await this.firmhouseQuery(
      `mutation {
        refundPayment(input: {
          id: ${this.firmhousePayment.id}
          amount: ${this.refundAmount}
          reason: "Product refunded in Shopify."
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

    const refundErrors = refund.data.errors;

    if (refundErrors) {
      console.log(`
        Error: ${JSON.stringify(refundErrors)}
      `);
      return;
    } else {
      console.log(`
        Refund created for ${this.firmhousePayment.id}
      `);
    }
  }

  async ensureOrder() {
    const firmhouseOrderQuery = await this.firmhouseQuery(`
        query {
          getOrderBy(shopifyId: "gid://shopify/Order/${this.body.order_id}") {
            id
            payment {
              id
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

    this.firmhouseOrder = firmhouseOrderQuery.data.data.getOrderBy;
  }

  findOrderedProduct(shopifyVariantId) {
    return this.firmhouseOrder.subscription.orderedProducts.find(
      (o) => o.product.shopifyVariantId == shopifyVariantId
    );
  }

  async firmhouseQuery(query) {
    const headers = { "Content-Type": "application/json" };
    if (this.projectAccessToken) {
      headers["X-Project-Access-Token"] = this.projectAccessToken;
    }
    if (this.subscriptionToken) {
      headers["X-Subscription-Token"] = this.subscriptionToken;
    }

    return axios({
      method: "POST",
      url: `https://portal.firmhouse.com/graphql`,
      headers: headers,
      data: JSON.stringify({ query: query }),
    });
  }

  get refundAmount() {
    let refundAmount = 0;

    for (const refundLineItem of this.body.refund_line_items) {
      const orderedProduct = this.findOrderedProduct(
        `gid://shopify/ProductVariant/${refundLineItem.line_item.variant_id}`
      );

      if (!orderedProduct) {
        console.log(
          `Ordered product not found for ${refundLineItem.line_item.variant_id}`
        );
      }

      refundAmount +=
        orderedProduct.priceIncludingTaxCents * refundLineItem.quantity;
    }

    return refundAmount.toFixed(2) / 100;
  }
}
