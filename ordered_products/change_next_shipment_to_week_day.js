const axios = require("axios");

module.exports = {
  name: "Change next shipment to week day",
  description: "Change next shipment date of ordered product.",
  key: "change_next_shipment_date_based_on_week_day",
  version: "0.0.5",
  type: "action",
  props: {
    dayOfTheWeek: {
      type: "integer",
      options: [
        { label: "Sunday", value: 0 },
        { label: "Monday", value: 1 },
        { label: "Tuesday", value: 2 },
        { label: "Wednesday", value: 3 },
        { label: "Thursday", value: 4 },
        { label: "Friday", value: 5 },
        { label: "Saturday", value: 6 },
      ]
    },
    firmhouseApiKey: {
      type: "string"
    },
    projectName: {
      type: "string"
    },
    requestBody: {
      type: "object"
    }
  },
  async run({ steps, $ }) {
    const api_url = "https://portal.firmhouse.com/graphql"
    const current_date = new Date()
    const previous_date = new Date(current_date.setDate(current_date.getDate() - 1))
    let previous_wednesday = null

    if (current_date.getDay() < this.dayOfTheWeek) {
      previous_wednesday = new Date(current_date.setDate(current_date.getDate() - (7 - (this.dayOfTheWeek - current_date.getDay()))))
    } else {
      previous_wednesday = new Date(current_date.setDate(current_date.getDate() - (current_date.getDay() - this.dayOfTheWeek)))
    }

    for (let ordered_product of this.requestBody.ordered_products) {
      let next_shipment_date = new Date()
      next_shipment_date.setDate(previous_wednesday.getDate() + (7 * ordered_product["interval"]))

      const response = await axios({
        method: "POST",
        url: api_url,
        params: {
          "query": `mutation {
            updateOrderedProduct(
              input: {
                id: ${ordered_product["id"]},
                shipmentDate: "${next_shipment_date.toISOString()}"
              }
            ) {
              orderedProduct { shipmentDate }
            }
          }`
        },
        headers: {
          "X-Project-Access-Token": this.firmhouseApiKey,
          "Content-Type": "application/json"
        }
      })

      if (response.status != 200) {
        throw new Error(this.projectName + 'API call failed to update ordered product next shipment date');
      } else if (response.data.errors != null) {
        throw new Error(this.projectName + 'API call failed to update ordered product next shipment date');
      }
    }

    return true
  },
}
