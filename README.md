# Pipedream actions

Collection of Pipedream actions that are used in the Firmhouse organisation.

## Installation

First, install the [Pipedream CLI](https://pipedream.com/docs/cli/install) to continue.

```bash
curl https://cli.pipedream.com/install | sh
```

Then run pd login to craete your Pipedream config file.

## Usage

More information on how to create actions through the CLI can be found [here](https://pipedream.com/docs/components/quickstart/nodejs/actions). But it comes down to creating a new directory in this repository, for example:

```javascript
# hello-world/action.js

module.exports = {
  name: "Action Demo",
  description: "This is a demo action",
  key: "action_demo",
  version: "0.0.1",
  type: "action",
  props: {},
  async run() {
    return `hello world!`
  },
}
```

## Publishing your action

To publish to Pipedream, you need to create a firmhouse profile so that the action ends up under the proper workspace.
Open your ~/.config/pipedream file and add the following:

```bash
[firmhouse]
api_key = [firmhouse api_key here]
org_id = [firmhouse org_id here]
```

You can find this API key and org_id if you go to [settings](https://pipedream.com/settings/account) and switch to the Firmhouse workspace.

After this, you can `cd` into your action's folder and run `pd publish` with your filename and profile name. For example:

```bash
cd ./hello-world
pd publish action.js -p firmhouse
```
