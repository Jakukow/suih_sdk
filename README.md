# USAGE

Read Call

```ts
async function exampleUsage() {
  const sdk = new SubscriptionManagerSDK();
  const result = await sdk.getAdmin();
}

exampleUsage();
```

Write Call

```ts
const tx = await sdk.buySubscription(TIER1);

const result = await sdk.client.signAndExecuteTransactionBlock({
  signer: keypair,
  transactionBlock: tx,
  options: {
    showEvents: true,
    showEffects: true,
  },
});
```
