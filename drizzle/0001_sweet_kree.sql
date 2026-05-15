CREATE TYPE "public"."import_order_status" AS ENUM('draft', 'pending', 'processing', 'in_transit', 'partially_received', 'completed', 'cancelled', 'returned');--> statement-breakpoint
CREATE TABLE "import_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"price" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_order_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_order_id" uuid NOT NULL,
	"from_status" "import_order_status",
	"to_status" "import_order_status" NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" "import_order_status" DEFAULT 'draft' NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "import_order_items" ADD CONSTRAINT "import_order_items_import_order_id_import_orders_id_fk" FOREIGN KEY ("import_order_id") REFERENCES "public"."import_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_order_items" ADD CONSTRAINT "import_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_order_logs" ADD CONSTRAINT "import_order_logs_import_order_id_import_orders_id_fk" FOREIGN KEY ("import_order_id") REFERENCES "public"."import_orders"("id") ON DELETE cascade ON UPDATE no action;