const ordersUrl = process.env.ORDERS_URL ?? "http://localhost:3002";
const productId = process.env.CLIENT_PRODUCT_ID ?? "coffee";
const quantity = Number(process.env.CLIENT_QUANTITY ?? "2");

async function main() {
  const response = await fetch(`${ordersUrl}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, quantity }),
  });

  if (!response.ok) {
    throw new Error(`Order request failed: ${response.status}`);
  }

  console.log("Created order:", await response.json());
}

if (import.meta.main) {
  await main();
}
