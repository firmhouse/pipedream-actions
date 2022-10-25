export default {
  name: "Calculate the asset purchase price from a mapping between months and prices.",
  key: "calculate_asset_purchase_price_from_mapping",
  version: "0.0.3",
  type: "action",
  props: {
    recurringInvoicesCount: {
      type: "integer",
      default: 1,
      min: 1
    },
    pricesMap: {
      type: "object",
      default: {
        1: 500,
        2: 450,
        3: 300,
        4: 200,
        5: 90
      }
    }
  },
  async run({$}) {
    var inMonth;
    const lastEntryInPricesMap = Object.keys(this.pricesMap)[Object.keys(this.pricesMap).length - 1]

    if (this.recurringInvoicesCount > lastEntryInPricesMap) {
      // Ensure that we never select an entry higher than available.
      inMonth = lastEntryInPricesMap;
    } else {
      inMonth = this.recurringInvoicesCount;
    }

    $.export("purchasePriceCents", this.pricesMap[inMonth] * 100)
  },
};
