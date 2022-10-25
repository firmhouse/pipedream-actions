import { axios } from "@pipedream/platform";

export default {
  name: "Set Asset purchase price",
  description:
    "Action that sets the purchase price for an asset by updating an asset ownership object via the Firmhouse API.",
  key: "set_asset_purchase_price",
  version: "0.0.5",
  type: "action",
  props: {
    firmhouseProjectAccessToken: {
      type: "string",
      secret: true
    },
    firmhouseApiUrl: {
      type: "string",
      default: "https://portal.firmhouse.com/graphql"
    },
    purchasePriceCents: {
      type: "integer",
      min: 1
    },
    assetOwnershipId: {
      type: "integer"
    }
  },
  async run({ $ }) {
    const data = await axios(this, {
      method: "POST",
      url: this.firmhouseApiUrl,
      params: {
        query: `mutation { updateAssetOwnership(input: {id: ${this.assetOwnershipId}, purchasePriceCents: ${this.purchasePriceCents}}) { assetOwnership { id purchasePriceCents } } }`,
      },
      headers: {
        "X-Project-Access-Token": this.firmhouseProjectAccessToken,
        "Content-Type": "application/json",
      },
    });

    return data;
  },
};
