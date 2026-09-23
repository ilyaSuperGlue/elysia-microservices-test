import { Elysia, t } from "elysia";
import { db } from "../db";
import { products } from "../schema";
import { eq } from "drizzle-orm";

const port = Number(process.env.CATALOG_PORT ?? 3001);

const toProduct = (product: typeof products.$inferSelect) => ({
  id: product.id,
  name: product.name,
  price: product.priceCents / 100,
});

const app = new Elysia()
  .get("/health", () => ({ service: "catalog", status: "ok" }))
  .get("/products", () => db.select().from(products).all().map(toProduct))
  .get(
    "/products/:id",
    ({ params, status }) => {
      const product = db
        .select()
        .from(products)
        .where(eq(products.id, params.id))
        .get();
      return product
        ? toProduct(product)
        : status(404, { error: "Product not found" });
    },
    { params: t.Object({ id: t.String() }) },
  )
  .listen(port);

console.log(
  `Catalog service is running at ${app.server?.hostname}:${app.server?.port}`,
);
