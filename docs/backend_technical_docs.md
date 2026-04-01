# Database Schema Documentation

> **ORM:** Drizzle ORM · **Database:** PostgreSQL  
> **Conventions:** UUID primary keys · Timestamps in UTC · Monetary values stored as integers (VND)

---

## Table of Contents

1. [Enums](#enums)
2. [Authentication & Users](#authentication--users)
3. [Catalog](#catalog)
4. [Inventory & Variants](#inventory--variants)
5. [Discounts & Promotions](#discounts--promotions)
6. [Cart & Orders](#cart--orders)
7. [Payments](#payments)
8. [Entity Relationship Overview](#entity-relationship-overview)

---

## Enums

| Enum             | Values                                                       |
| ---------------- | ------------------------------------------------------------ |
| `user_role`      | `customer`, `admin`, `superadmin`                            |
| `discount_types` | `percentage`, `fixed`                                        |
| `order_status`   | `pending`, `processing`, `shipped`, `delivered`, `cancelled` |
| `payment_status` | `pending`, `success`, `failed`, `cancelled`, `refunded`      |

---

## Authentication & Users

### `users`

Stores all accounts across every role. OAuth and credential-based login are unified in a single table via the `provider` + `provider_id` composite unique index.

| Column           | Type          | Notes                  |
| ---------------- | ------------- | ---------------------- |
| `id`             | `uuid`        | PK, random             |
| `email`          | `text`        | Unique, not null       |
| `phone`          | `varchar(15)` | Unique, not null       |
| `name`           | `text`        |                        |
| `email_verified` | `timestamp`   | Null = unverified      |
| `image`          | `text`        | Avatar URL             |
| `password_hash`  | `text`        | Null for OAuth users   |
| `role`           | `user_role`   | Default: `customer`    |
| `provider`       | `varchar(32)` | Default: `credentials` |
| `provider_id`    | `text`        | External OAuth ID      |
| `created_at`     | `timestamp`   |                        |
| `updated_at`     | `timestamp`   |                        |

**Indexes:** `provider_idx` (provider, provider_id) · `users_email_idx` · `users_phone_idx`

---

### `refresh_tokens`

Supports multi-device login. Each row represents one active session. Tokens are stored as a hash — never plain text.

| Column        | Type           | Notes                            |
| ------------- | -------------- | -------------------------------- |
| `id`          | `uuid`         | PK                               |
| `user_id`     | `uuid`         | FK → `users.id` (cascade delete) |
| `token_hash`  | `varchar(512)` | Hashed refresh token, unique     |
| `expires_at`  | `timestamp`    |                                  |
| `revoked_at`  | `timestamp`    | Null = still valid               |
| `device_info` | `text`         | User-agent string                |
| `ip_address`  | `varchar(45)`  | Supports IPv6                    |
| `created_at`  | `timestamp`    |                                  |

---

### `user_addresses`

Address book per user. Uses Vietnamese administrative codes (province / district / ward) for address resolution.

| Column           | Type          | Notes                  |
| ---------------- | ------------- | ---------------------- |
| `id`             | `uuid`        | PK                     |
| `user_id`        | `uuid`        | FK → `users.id`        |
| `recipient_name` | `text`        |                        |
| `address`        | `text`        | Street-level detail    |
| `phone`          | `varchar(15)` | Contact for delivery   |
| `province_code`  | `text`        | VN administrative code |
| `district_code`  | `text`        |                        |
| `ward_code`      | `text`        |                        |
| `is_default`     | `boolean`     | Default: `false`       |

---

## Catalog

### `categories`

Self-referencing tree. Supports unlimited depth (e.g., **Electronics → Smartphones → iPhone**).

| Column                      | Type        | Notes                          |
| --------------------------- | ----------- | ------------------------------ |
| `id`                        | `uuid`      | PK                             |
| `name`                      | `text`      |                                |
| `image`                     | `text`      |                                |
| `slug`                      | `text`      | Unique, URL-safe               |
| `parent_id`                 | `uuid`      | Self-reference FK, null = root |
| `is_deleted`                | `boolean`   | Soft delete, default `false`   |
| `created_at` / `updated_at` | `timestamp` |                                |

**Indexes:** `categories_parent_idx` · `categories_slug_idx`

---

### `brands`

Manufacturer or brand (e.g., Apple, Samsung).

| Column                      | Type           | Notes       |
| --------------------------- | -------------- | ----------- |
| `id`                        | `uuid`         | PK          |
| `name`                      | `text`         |             |
| `slug`                      | `varchar(255)` | Unique      |
| `logo`                      | `text`         |             |
| `description`               | `text`         |             |
| `is_deleted`                | `boolean`      | Soft delete |
| `created_at` / `updated_at` | `timestamp`    |             |

---

### `products`

The base product container (e.g., _"iPhone 17 Pro Max"_). Does not represent a purchasable item — variants do.

| Column        | Type           | Notes                          |
| ------------- | -------------- | ------------------------------ |
| `id`          | `uuid`         | PK                             |
| `category_id` | `uuid`         | FK → `categories.id`           |
| `brand_id`    | `uuid`         | FK → `brands.id`, nullable     |
| `name`        | `text`         |                                |
| `slug`        | `varchar(255)` | Unique                         |
| `description` | `jsonb`        | Rich text / structured content |
| `created_at`  | `timestamp`    |                                |
| `is_deleted`  | `boolean`      | Soft delete, default `false`   |
| `updated_at`  | `timestamp`    |                                |

**Indexes:** `products_category_idx` · `products_slug_idx`

---

### Attribute System

The attribute system is a 3-tier hierarchy that enables flexible, category-specific product specifications.

```
attribute_groups  (e.g., "Performance")
    └── attributes  (e.g., "Processor", "RAM")
            └── attribute_options  (e.g., "A18 Pro", "8GB")
```

#### `attribute_groups`

Groups related attributes under a category.

| Column        | Type   | Notes                |
| ------------- | ------ | -------------------- |
| `id`          | `uuid` | PK                   |
| `name`        | `text` | Unique               |
| `category_id` | `uuid` | FK → `categories.id` |

#### `attributes`

Individual spec fields (e.g., _Processor_, _Screen Size_).

| Column       | Type          | Notes                      |
| ------------ | ------------- | -------------------------- |
| `id`         | `uuid`        | PK                         |
| `group_id`   | `uuid`        | FK → `attribute_groups.id` |
| `name`       | `text`        |                            |
| `slug`       | `text`        | Unique within group        |
| `type`       | `varchar(32)` | Default: `text`            |
| `filterable` | `boolean`     | Show in filter sidebar     |
| `unit`       | `text`        | e.g., "inch", "GB"         |
| `sort_order` | `serial`      | Display ordering           |

**Unique index:** `attributes_slug_groupId_idx` (slug, group_id)

#### `attribute_options`

Predefined values for an attribute (e.g., _Processor_ → `"A18 Pro"`).

| Column         | Type           | Notes                |
| -------------- | -------------- | -------------------- |
| `id`           | `uuid`         | PK                   |
| `attribute_id` | `uuid`         | FK → `attributes.id` |
| `value`        | `text`         | Display value        |
| `slug`         | `varchar(255)` |                      |

---

### `product_attribute_values`

Specs shared by **all variants** of a product (e.g., Screen Size = _6.9 inch_ applies to every storage/color combination).

| Column         | Type   | Notes                                 |
| -------------- | ------ | ------------------------------------- |
| `id`           | `uuid` | PK                                    |
| `product_id`   | `uuid` | FK → `products.id`                    |
| `attribute_id` | `uuid` | FK → `attributes.id`                  |
| `value`        | `text` | For free-text attributes              |
| `option_id`    | `uuid` | FK → `attribute_options.id`, optional |

---

## Inventory & Variants

### `product_variants`

The actual purchasable SKU (e.g., _"iPhone 17 Pro Max – 256GB / Space Black"_). Holds price and stock.

| Column       | Type           | Notes              |
| ------------ | -------------- | ------------------ |
| `id`         | `uuid`         | PK                 |
| `product_id` | `uuid`         | FK → `products.id` |
| `sku`        | `varchar(255)` | Unique per product |
| `name`       | `text`         | Full display name  |
| `price`      | `integer`      | In VND (raw)       |
| `stock`      | `integer`      | Default: `0`       |

**Unique index:** `product_variants_sku_productId_idx` (sku, product_id)

---

### `variant_attribute_values`

Maps a SKU to its differentiating options (e.g., _Storage = 256GB, Color = Blue_). A variant can hold **only one value per attribute** enforced by composite PK.

| Column         | Type   | Notes                                       |
| -------------- | ------ | ------------------------------------------- |
| `variant_id`   | `uuid` | FK → `product_variants.id` (cascade delete) |
| `attribute_id` | `uuid` | FK → `attributes.id`                        |
| `option_id`    | `uuid` | FK → `attribute_options.id`                 |
| `value`        | `text` | For free-text overrides                     |

**PK:** (`variant_id`, `attribute_id`)

---

### `product_images`

Global image pool for a product.

| Column       | Type      | Notes                  |
| ------------ | --------- | ---------------------- |
| `id`         | `uuid`    | PK                     |
| `product_id` | `uuid`    | FK → `products.id`     |
| `url`        | `text`    |                        |
| `secure_url` | `text`    | HTTPS CDN URL          |
| `public_id`  | `text`    | Cloudinary public ID   |
| `is_main`    | `boolean` | Main product thumbnail |
| `sort_order` | `integer` | Default: `0`           |

---

### `variant_images`

Links a variant to images from the product's global pool. Each variant can designate its own main image.

| Column       | Type      | Notes                      |
| ------------ | --------- | -------------------------- |
| `variant_id` | `uuid`    | FK → `product_variants.id` |
| `image_id`   | `uuid`    | FK → `product_images.id`   |
| `is_main`    | `boolean` | Variant's primary image    |

**PK:** (`variant_id`, `image_id`)

---

## Discounts & Promotions

### Discount Events

A two-level grouping system for promotional campaigns:

```
discount_events_groups  (e.g., "Mega Sale 2025 Banner")
    └── discount_events  (e.g., "Flash Sale – Morning Slot")
            └── discount_event_products  (per-product discount config)
```

#### `discount_events_groups`

| Column                    | Type        | Notes            |
| ------------------------- | ----------- | ---------------- |
| `id`                      | `uuid`      | PK               |
| `name`                    | `text`      |                  |
| `description`             | `text`      |                  |
| `order`                   | `integer`   | Display ordering |
| `banner_image`            | `text`      |                  |
| `is_active`               | `boolean`   |                  |
| `start_date` / `end_date` | `timestamp` |                  |

#### `discount_events`

| Column       | Type        | Notes                                      |
| ------------ | ----------- | ------------------------------------------ |
| `id`         | `uuid`      | PK                                         |
| `group_id`   | `uuid`      | FK → `discount_events_groups.id`, nullable |
| `name`       | `text`      |                                            |
| `start_date` | `timestamp` |                                            |
| `end_date`   | `timestamp` | Nullable — can be ended manually           |

#### `discount_event_products`

Configures the discount applied to a specific product within an event.

| Column                | Type      | Notes                          |
| --------------------- | --------- | ------------------------------ |
| `event_id`            | `uuid`    | FK → `discount_events.id`      |
| `product_id`          | `uuid`    | FK → `products.id`             |
| `discount_percentage` | `integer` | 0–100                          |
| `stock`               | `integer` | Units allocated for this event |

---

### `promo_code`

One-time or limited-use coupon codes with date-bound validity.

| Column                    | Type             | Notes                           |
| ------------------------- | ---------------- | ------------------------------- |
| `id`                      | `uuid`           | PK                              |
| `code`                    | `varchar(50)`    | Unique                          |
| `discount_type`           | `discount_types` | `percentage` or `fixed`         |
| `discount_value`          | `integer`        | Amount or %                     |
| `description`             | `text`           |                                 |
| `limit`                   | `integer`        | Max total redemptions           |
| `used`                    | `integer`        | Redemption counter, default `0` |
| `start_date` / `end_date` | `timestamp`      |                                 |
| `is_active`               | `boolean`        | Manual toggle                   |

---

### `promo_usage`

Tracks which user applied which promo code to which order. Prevents duplicate usage.

| Column            | Type      | Notes                     |
| ----------------- | --------- | ------------------------- |
| `id`              | `uuid`    | PK                        |
| `promo_code_id`   | `uuid`    | FK → `promo_code.id`      |
| `user_id`         | `uuid`    | FK → `users.id`           |
| `order_id`        | `uuid`    | FK → `customer_orders.id` |
| `discount_amount` | `integer` | Actual VND saved          |

---

## Cart & Orders

### `customer_carts`

Persisted shopping cart. One row per variant per user.

| Column       | Type      | Notes                      |
| ------------ | --------- | -------------------------- |
| `id`         | `uuid`    | PK                         |
| `user_id`    | `uuid`    | FK → `users.id`            |
| `variant_id` | `uuid`    | FK → `product_variants.id` |
| `quantity`   | `integer` | Default: `1`               |

**Indexes:** `customer_carts_user_idx` · `customer_carts_variant_idx`

### `customer_orders`

Order header. Shipping info is **snapshotted** at time of order so historical records remain accurate even if the user later edits their address book.

| Column             | Type           | Notes                          |
| ------------------ | -------------- | ------------------------------ |
| `id`               | `uuid`         | PK                             |
| `user_id`          | `uuid`         | FK → `users.id`                |
| `promo_code_id`    | `uuid`         | FK → `promo_code.id`, nullable |
| `status`           | `order_status` | Default: `pending`             |
| `total`            | `integer`      | Final amount in VND            |
| `discount_amount`  | `integer`      | Total discount applied         |
| `shipping_fee`     | `integer`      |                                |
| `shipping_address` | `text`         | Snapshot                       |
| `shipping_phone`   | `varchar(15)`  | Snapshot                       |
| `shipping_name`    | `text`         | Snapshot                       |
| `province_code`    | `text`         | Snapshot                       |
| `district_code`    | `text`         | Snapshot                       |
| `ward_code`        | `text`         | Snapshot                       |

**Indexes:** `orders_user_idx` · `orders_status_idx`

---

### `customer_orders_items`

Line items belonging to an order.

| Column       | Type      | Notes                                |
| ------------ | --------- | ------------------------------------ |
| `id`         | `uuid`    | PK                                   |
| `order_id`   | `uuid`    | FK → `customer_orders.id`            |
| `variant_id` | `uuid`    | FK → `product_variants.id`           |
| `quantity`   | `integer` |                                      |
| `price`      | `integer` | Price at time of purchase (snapshot) |

---

### `order_logs`

Immutable audit trail of every order status transition.

| Column        | Type           | Notes                     |
| ------------- | -------------- | ------------------------- |
| `id`          | `uuid`         | PK                        |
| `order_id`    | `uuid`         | FK → `customer_orders.id` |
| `from_status` | `order_status` | Nullable (first entry)    |
| `to_status`   | `order_status` |                           |
| `note`        | `text`         | Admin comment             |
| `created_at`  | `timestamp`    |                           |

---

## Payments

### `payment_methods`

Registry of available payment providers.

| Column      | Type          | Notes                        |
| ----------- | ------------- | ---------------------------- |
| `id`        | `uuid`        | PK                           |
| `code`      | `varchar(50)` | Unique, e.g. `vnpay`, `momo` |
| `name`      | `text`        | Display name                 |
| `is_active` | `boolean`     |                              |
| `config`    | `jsonb`       | Provider-specific settings   |

---

### `payments`

One payment attempt per order.

| Column              | Type          | Notes                     |
| ------------------- | ------------- | ------------------------- |
| `id`                | `uuid`        | PK                        |
| `order_id`          | `uuid`        | FK → `customer_orders.id` |
| `payment_method_id` | `uuid`        | FK → `payment_methods.id` |
| `amount`            | `integer`     | In VND                    |
| `status`            | `varchar(50)` | Default: `pending`        |
| `transaction_id`    | `text`        | Internal reference        |

---

### `payment_transaction_logs`

Raw event log for every interaction with a payment gateway. Used for debugging, reconciliation, and dispute resolution.

| Column                    | Type          | Notes                                                       |
| ------------------------- | ------------- | ----------------------------------------------------------- |
| `id`                      | `uuid`        | PK                                                          |
| `payment_id`              | `uuid`        | FK → `payments.id`                                          |
| `action`                  | `varchar(50)` | e.g. `initiate`, `webhook_success`, `refund`, `user_cancel` |
| `status`                  | `varchar(50)` | State at time of log                                        |
| `provider_transaction_id` | `text`        | Gateway's own TX ID                                         |
| `payload`                 | `jsonb`       | Raw request/response body                                   |
| `error_message`           | `text`        |                                                             |
| `created_at`              | `timestamp`   |                                                             |

---

## Entity Relationship Overview

```
users
 ├── refresh_tokens
 ├── user_addresses
 ├── customer_carts ──────────────── product_variants
 ├── customer_orders ─────────────── promo_code
 │    ├── customer_orders_items ───── product_variants
 │    ├── order_logs
 │    ├── payments ────────────────── payment_methods
 │    │    └── payment_transaction_logs
 │    └── promo_usage
 └── promo_usage

categories (self-referencing tree)
 └── attribute_groups
      └── attributes
           └── attribute_options

products ─── categories
 │      └─── brands
 ├── product_attribute_values ─── attributes / attribute_options
 ├── product_variants
 │    ├── variant_attribute_values ── attributes / attribute_options
 │    └── variant_images ─────────── product_images
 ├── product_images
 └── discount_event_products ─── discount_events
                                      └── discount_events_groups
```

---

> **Notes**
>
> - Prices and monetary amounts are always stored as **integers in VND**. No decimals.
> - Shipping info in `customer_orders` is a **snapshot** — never joined back to `user_addresses` for historical records.
> - `order_logs` is append-only; never update or delete rows.
> - `payment_transaction_logs.payload` stores the full raw body from the payment gateway for auditing purposes.
> - Soft deletes (`is_deleted`) are used on `categories` and `brands`; all other tables use hard deletes.

