import { axios } from "@pipedream/platform";

export default {
  name: "Calculate asset purchase price",
  description:
    "Sample to calculate an asset purchase price based on the number of recurring invoices charged so far.",
  key: "calculate_asset_purchase_price",
  version: "0.0.2",
  type: "action",
  props: {},
  async run(event, steps, params) {
    const subscriptionId = steps.trigger.event.body.subscriptionId;

    if (!steps.trigger.event.body.signupCompletedAt) {
      $end("signupCompletedAt is empty.");
    }

    if (!steps.trigger.event.body.assetOwnershipIds.length) {
      $end("No assetOwnershipIds passed.");
    }

    const assetOwnershipId = steps.trigger.event.body.assetOwnershipIds[0];
    const planId = steps.trigger.event.body.planId;
    const signupCompletedAt = new Date(
      steps.trigger.event.body.signupCompletedAt
    );
    const activatedAt = new Date(
      steps.trigger.event.body.subscriptionActivatedAt
    );
    const startingDate = steps.trigger.event.body.importedSubscriptionId
      ? signupCompletedAt
      : activatedAt;
    const endDate = new Date();

    if (!startingDate) {
      $end("startingDate is empty.");
    }

    const monthsBtwnDates = (startDate, endDate) => {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
      console.log("-----");
      console.log("Subscription started:", startDate);
      console.log("Now:", endDate);
      return Math.max(
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          endDate.getMonth() -
          startDate.getMonth(),
        0
      );
    };

    let fullMonthsPassed = monthsBtwnDates(startingDate, endDate);
    console.log("full months count between dates:", fullMonthsPassed);

    if (endDate.getDate() >= startingDate.getDate()) {
      fullMonthsPassed += 1;
    }
    console.log(
      "full months subscribed (w dates adjustments):",
      fullMonthsPassed
    );
    console.log("-----");
    console.log(
      "only for the reference! recurringInvoicesCount is:",
      steps.trigger.event.body.invoicesCount
    );
    console.log("-----");

    let month = fullMonthsPassed;
    if (month > 16) {
      month = 16;
    }
    if (month == 0) {
      month = 1;
    }

    return {
      subscriptionId: subscriptionId,
      assetOwnershipId: assetOwnershipId,
    };
  },
};
