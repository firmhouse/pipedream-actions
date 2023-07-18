const axios = require("axios");

module.exports = {
  name: "Destroy ordered products",
  description: "Destroy given ordered products.",
  key: "destroy_ordered_products",
  version: "0.0.3",
  type: "action",
  props: {
    orderedProductsAndProductIds: {
      type: "object"
    },
    firmhouseApiKey: {
      type: "string"
    },
    ignoreProductIds: {
      type: "integer[]"
    },
    projectName: {
      type: "string"
    }
  },
  async run({ steps, $ }) {
    const api_url = "https://portal.firmhouse.com/graphql"

    for (let ordered_product of this.orderedProductsAndProductIds) {
      if (!this.ignoreProductIds.includes(ordered_product["product_id"])) {
        const response = await axios({
          method: "POST",
          url: api_url,
          params: {
            "query": `mutation {
              destroyOrderedProduct(
                input: {
                  id: ${ordered_product["id"]}
                }
              ) {
                subscription {
                  token
                }
              }
            }`
          },
          headers: {
            "X-Project-Access-Token": this.firmhouseApiKey,
            "Content-Type": "application/json"
          }
        })

        if (response.status != 200) {
          throw new Error(this.projectName + 'API call failed to destroy ordered product');
        } else if (response.data.errors != null) {
          throw new Error(this.projectName + 'API call failed to destroy ordered product');
        }
      }
    }

    return true
  },
}
