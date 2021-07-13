# Pipedream actions

Collection of Pipedream actions that are used in the Firmhouse organisation.

## Installation

First, install the [Pipedream CLI](https://pipedream.com/docs/cli/install) to continue.

```bash
curl https://cli.pipedream.com/install | sh
```

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

To publish to Pipedream, cd into your action's folder and run `pd publish` with your filename.

```bash
cd ./hello-world
pd publish action.js
```
