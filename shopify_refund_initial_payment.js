const axios = require("axios");

module.exports = {
  name: "Shopify Refund Initial Payment",
  description:
    "This action uses the Firmhouse API to (partially) refund an initial payment based on a refunded Shopify order",
  key: "shopify_refund_initial_payment",
  version: "0.0.26",
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

    this.firmhouseSubscription = this.firmhouseOrder.subscription;
    this.firmhouseInvoice = this.initialInvoice;
    this.firmhousePayment = this.firmhouseInvoice.payment;

    if (!this.firmhouseInvoice) return "No initial invoice found.";
    if (!this.firmhousePayment) return "No payment found to peform the refund on.";

    await this.updateOrderedProducts();
    await this.performRefund();
    await this.cancelSubscription();
  }

  async cancelSubscription() {
    const firmhouseSubscriptionQuery = await this.firmhouseQuery(`
      query {
        getSubscription(token: "${this.firmhouseSubscription.token}") {
          orderedProducts {
            id
            title
          }
        }
      }
    `);

    const orderedProducts = firmhouseSubscriptionQuery.data.data.getSubscription.orderedProducts;

    var activeProductCount = orderedProducts.length;

    const isReturnProduct = (element) => element["title"] == "Option return old jeans";
    if (orderedProducts.findIndex(isReturnProduct) >= 0) {
      activeProductCount = activeProductCount - 1;
    }

    if (activeProductCount > 0) return;

    await this.firmhouseQuery(`
      mutation {
        cancelSubscription(
          input: {
            token: "${this.firmhouseSubscription.token}",
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
        console.log(`Ordered product not found for ${refundLineItem.line_item.variant_id}`);
        return;
      }

      const newQuantity = orderedProduct.quantity - refundLineItem.quantity;

      if (newQuantity > 0) {
        console.log(`Updating quantity for ${orderedProduct.id} to ${newQuantity}`);

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
          console.log(`Updated ordered product #${orderedProduct.id} to quantity ${newQuantity}`);
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
      }
    }
  }

  async performRefund() {
    console.log(`Will create refund here for ${this.firmhousePayment.id} for € ${this.refundAmount}`);

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
    const firmhouseOrderQuery = await this.firmhouseQuery(
      `query {
        getOrderBy(shopifyId: "gid://shopify/Order/${this.body.order_id}") {
          id
          subscription {
            id
            token
            invoices {
              id
              invoiceLineItems {
                lineItemType
                effectiveAmountIncludingTaxCents
                product {
                  shopifyVariantId
                }
              }
              payment {
                id
                paymentType
              }
            }
            orderedProducts {
              id
              quantity
              product {
                shopifyVariantId
              }
            }
          }
        }
      }`
    );

    this.firmhouseOrder = firmhouseOrderQuery.data.data.getOrderBy;
  }

  get initialInvoice() {
    return this.firmhouseSubscription.invoices.find((i) => i.payment.paymentType == "INITIAL");
  }

  findOrderedProduct(shopifyVariantId) {
    return this.firmhouseSubscription.orderedProducts.find(
      (o) => o.product.shopifyVariantId == shopifyVariantId
    );
  }

  findInvoiceLineItemForVariantId(shopifyVariantId) {
    return this.firmhouseInvoice.invoiceLineItems.find(
      (invoiceLineItem) =>
        invoiceLineItem.product && invoiceLineItem.product.shopifyVariantId == shopifyVariantId
    );
  }

  async firmhouseQuery(query) {
    const headers = { "Content-Type": "application/json" };
    if (this.projectAccessToken) headers["X-Project-Access-Token"] = this.projectAccessToken;
    if (this.firmhouseSubscription) headers["X-Subscription-Token"] = this.firmhouseSubscription.token;

    return axios({
      method: "POST",
      url: `https://portal.firmhouse.com/graphql`,
      headers: headers,
      data: {
        query: query,
      },
    });
  }

  get refundAmount() {
    let refundAmount = 0;

    for (const refundLineItem of this.body.refund_line_items) {
      const invoiceLineItem = this.findInvoiceLineItemForVariantId(
        `gid://shopify/ProductVariant/${refundLineItem.line_item.variant_id}`
      );

      if (!invoiceLineItem) {
        console.log(`invoiceLineItem not found for ${refundLineItem.line_item.variant_id}`);
      }

      refundAmount += invoiceLineItem.effectiveAmountIncludingTaxCents * refundLineItem.quantity;
    }

    refundAmount += this.shippingRefundAmount;

    return refundAmount.toFixed(2) / 100;
  }

  get shippingRefundAmount() {
    let shippingRefundAmount = 0;

    const shippingRefund = this.body.order_adjustments.find((oa) => oa.kind == "shipping_refund");

    if (shippingRefund) {
      const shippingLineItem = this.firmhouseInvoice.invoiceLineItems.find(
        (invoiceLineItem) => invoiceLineItem.lineItemType == "SHIPPING"
      );

      if (shippingLineItem) {
        shippingRefundAmount = shippingLineItem.effectiveAmountIncludingTaxCents;
      } else {
        console.log("Shipping refund detected but no line item found");
      }
    }

    return shippingRefundAmount;
  }
}
