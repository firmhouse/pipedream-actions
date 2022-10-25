export default {
  name: "Calculate asset purchase price",
  description:
    "Sample to calculate an asset purchase price based on the number of recurring invoices charged so far.",
  key: "calculate_asset_purchase_price",
  version: "0.0.6",
  type: "action",
  props: {
    recurringInvoicesCount: {
      type: "integer",
      default: 1,
      min: 1
    },
  },
  async run({$}) {
    const pricesMap = {
      1: 514,
      2: 479,
      3: 449
    }

    var inMonth;

    if (this.recurringInvoicesCount > 3) { // Ensure that we never select a higher month than 3.
      inMonth = 3;
    } else {
      inMonth = this.recurringInvoicesCount;
    }

    return pricesMap[inMonth] * 100;
  },
};
