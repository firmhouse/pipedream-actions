const axios = require("axios");

module.exports = {
  name: "Change next billing date",
  description: "Change next billing date of subscribed plan, send subscribed_plan_id in trigger event body.",
  key: "change_next_billing_date",
  version: "0.0.5",
  type: "action",
  props: {
    dayOfTheMonth: {
      type: "integer",
      default: 1,
      min: 1
    },
    firmhouseApiKey: {
      type: "string"
    },
    projectName: {
      type: "string"
    },
    subscribedPlanId: {
      type: "integer"
    }
  },
  async run({ steps, $ }) {
    const api_url = "https://portal.firmhouse.com/graphql"
    const current_date = new Date()

    let next_billing_date = null

    if (current_date.getDate() >= this.dayOfTheMonth) {
      if (current_date.getMonth() == 11) {
        next_billing_date = new Date(current_date.getFullYear() + 1, 0, 1)
      } else {
        next_billing_date = new Date(current_date.getFullYear(), current_date.getMonth() + 1, 1)
      }
    } else {
      next_billing_date = new Date(current_date.getFullYear(), current_date.getMonth(), 1)
    }

    const response = await axios({
      method: "POST",
      url: api_url,
      params: {
        "query": `mutation {
                    updateSubscribedPlan(
                      input: {
                        id: ${this.subscribedPlanId},
                        nextBillingDate: "${next_billing_date.toISOString()}"
                      }) {
                        subscribedPlan { nextBillingDate }
                      }
                    }`
      },
      headers: {
        "X-Project-Access-Token": this.firmhouseApiKey,
        "Content-Type": "application/json"
      }
    })

    if (response.status != 200) {
      throw new Error(this.projectName + 'API call failed to update subscribed plans next billing date');
    } else if (response.data.errors != null) {
      throw new Error(this.projectName + 'API call failed to update subscribed plans next billing date');
    }

    return response.data
  },
}
