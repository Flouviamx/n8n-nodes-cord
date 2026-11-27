# n8n-nodes-cord

The [Cord](https://cordhq.app) node for n8n. Cord takes a sale from proposal to payment in a single link: quotes, clients, invoices and payments.

## Installation

On self-hosted n8n, open **Settings › Community Nodes › Install** and enter `n8n-nodes-cord`.

## Credentials

The node uses a **Cord API** credential with a secret API key.

1. In Cord, turn on **Developer mode** at the bottom of the Settings index.
2. Open the **API** tab and create a **secret key** with write access.
3. Paste it in the Cord API credential in n8n. Keys that start with `sk_test_` work with your Cord test environment.

## Nodes

- **Cord Trigger** starts a workflow when something happens in Cord: a quote is sent, opened, approved or paid, an invoice is paid, a client is created, and more. It registers its own webhook in Cord when the workflow is activated, removes it when it is deactivated, and verifies the `X-Cord-Signature-V1` signature on every delivery.
- **Cord** works with Cord data:
  - Clients: create, update, get and search.
  - Quotes: create, get, search, send and mark as paid.
  - Tasks: create.

The **Cord** node can also be used as a tool by AI agents in n8n.

## Usage examples

### Create a client and send them a quote

1. Add a **Cord** node and set **Resource** to *Client* and **Operation** to *Create*.
   - **Company**: `Acme Corp`
   - **Additional Fields › Email**: `billing@acme.com`
   - **Additional Fields › Country Code**: `US`
2. Add a second **Cord** node and set **Resource** to *Quote* and **Operation** to *Create*.
   - **Client ID**: `{{ $json.id }}` (the client created by the first node)
   - **Items › Add Item**: Description `Website redesign`, Quantity `1`, Unit Price `4500`
   - **Additional Fields › Currency**: `USD`
   - **Additional Fields › Valid For (Days)**: `30`
   - **Additional Fields › Send Now**: on
3. Run the workflow. The second node returns the quote, including:

```json
{
  "id": "6f1c2a9e-4b7d-4e2a-9c51-0d3b8f7a1e64",
  "folio": "Q-00104",
  "status": "sent",
  "moneda": "USD",
  "total": 4500,
  "link_publico": "https://cordhq.app/q/..."
}
```

`link_publico` is the link the client opens to review, approve and pay the quote.

### Create a follow-up task when a client approves a quote

1. Add a **Cord Trigger** node and select the event **Quotes: Quote approved**.
2. Add a **Cord** node and set **Resource** to *Task* and **Operation** to *Create*.
   - **Title**: `Kick off {{ $json.data.folio }} with {{ $json.data.cliente }}`
   - **Additional Fields › Quote ID**: `{{ $json.data.id }}`
   - **Additional Fields › Due Date**: `{{ $now.plus(1, 'day') }}`
3. Activate the workflow. Cord Trigger registers its webhook in Cord, and each approval reaches the workflow as:

```json
{
  "event": "quote.approved",
  "data": {
    "id": "6f1c2a9e-4b7d-4e2a-9c51-0d3b8f7a1e64",
    "folio": "Q-00104",
    "status": "approved",
    "moneda": "USD",
    "total": 4500,
    "cliente": "Acme Corp",
    "cliente_id": "2d8e5b10-7c3f-4a9d-b6e1-93f0c4a2d785"
  }
}
```

The task appears in Cord under **Tasks**, linked to the quote.

## Compatibility

Works with n8n 1.x and 2.x. Built with the official `@n8n/node-cli` and eligible for n8n Cloud verification.

## Resources

- [Cord for n8n](https://cordhq.app/en/integrations/n8n)
- [Connect Cord with n8n](https://cordhq.app/en/support/connect-n8n)
- [Cord API documentation](https://docs.cordhq.app/en/docs/developers/get-started/overview)

## Development

```bash
npm install
npm run lint     # n8n's rules for community nodes, including n8n Cloud eligibility
npm test         # builds, then checks the package, the event list and the signature
npm run dev      # runs n8n locally with this node
```

`npm run release` bumps the version, tags it and pushes; the Publish workflow publishes to npm with provenance.

## License

[MIT](LICENSE)
