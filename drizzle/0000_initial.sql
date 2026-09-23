CREATE TABLE IF NOT EXISTS `notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `text` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `product_name` text NOT NULL,
  `unit_price` integer NOT NULL,
  `quantity` integer NOT NULL,
  `total` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `products` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `price_cents` integer NOT NULL
);
