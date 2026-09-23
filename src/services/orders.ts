import { Elysia, t } from "elysia";
import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { orders } from "../schema";
import { publishOrderCreated } from "../integrations/kafka";

const catalogUrl = process.env.CATALOG_URL ?? "http://localhost:3001";
const port = Number(process.env.ORDERS_PORT ?? 3002);
const redis = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redis.on("error", () => {});

type OrderResponse = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  createdAt: string;
};

const toResponse = (order: typeof orders.$inferSelect): OrderResponse => ({
  id: order.id,
  productId: order.productId,
  productName: order.productName,
  unitPrice: order.unitPrice / 100,
  quantity: order.quantity,
  total: order.total / 100,
  createdAt: order.createdAt,
});

const cacheKey = (id: string) => `order:${id}`;
const readCachedOrder = async (id: string) => {
  try {
    const value = await redis.get(cacheKey(id));
    return value ? (JSON.parse(value) as OrderResponse) : undefined;
  } catch {
    return undefined;
  }
};
const cacheOrder = async (order: OrderResponse) => {
  try {
    await redis.set(cacheKey(order.id), JSON.stringify(order), "EX", 300);
  } catch {}
};

const app = new Elysia()
  .get("/health", () => ({ service: "orders", status: "ok" }))
  .get("/orders", () => db.select().from(orders).all().map(toResponse))
  .get("/orders/:id", async ({ params, status }) => {
    const cached = await readCachedOrder(params.id);
    if (cached) return cached;
    const order = db
      .select()
      .from(orders)
      .where(eq(orders.id, params.id))
      .get();
    if (!order) return status(404, { error: "Order not found" });
    const response = toResponse(order);
    await cacheOrder(response);
    return response;
  })
  .post(
    "/orders",
    async ({ body, status }) => {
      let response: Response;
      try {
        response = await fetch(`${catalogUrl}/products/${body.productId}`);
      } catch {
        return status(503, { error: "Catalog unavailable" });
      }
      if (!response.ok) return status(400, { error: "Unknown product" });
      const product = (await response.json()) as {
        id: string;
        name: string;
        price: number;
      };
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const order = {
        id,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: body.quantity,
        total: product.price * body.quantity,
        createdAt,
      };
      try {
        db.insert(orders)
          .values({
            ...order,
            unitPrice: Math.round(product.price * 100),
            total: Math.round(order.total * 100),
          })
          .run();
        await publishOrderCreated(order);
        await cacheOrder({
          ...order,
          unitPrice: product.price,
          total: order.total,
        });
      } catch (error) {
        console.error("Order creation failed", error);
        return status(500, { error: "Order creation failed" });
      }
      return { ...order, product };
    },
    {
      body: t.Object({
        productId: t.String(),
        quantity: t.Integer({ minimum: 1 }),
      }),
    },
  )
  .listen(port);

console.log(
  `Orders service is running at ${app.server?.hostname}:${app.server?.port}`,
);
