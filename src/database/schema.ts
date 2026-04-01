import {
  AnyPgColumn,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { pgEnum } from 'drizzle-orm/pg-core';
export const userRole = pgEnum('user_role', [
  'customer',
  'admin',
  'superadmin',
]);
export const discountTypes = pgEnum('discount_types', ['percentage', 'fixed']);
export const orderStatus = pgEnum('order_status', [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'success',
  'failed',
  'expired',
  'cancelled',
  'refunded',
  'partial_refunded',
]);
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').unique().notNull(),
    phone: varchar('phone', { length: 15 }).unique().notNull(),
    name: text('name'),
    emailVerified: timestamp('email_verified', { mode: 'date' }),
    image: text('image'),
    passwordHash: text('password_hash'),
    role: userRole('role').notNull().default('customer'),
    provider: varchar('provider', { length: 32 })
      .notNull()
      .default('credentials'),
    providerId: text('provider_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('provider_idx').on(table.provider, table.providerId),
    index('users_email_idx').on(table.email),
    index('users_phone_idx').on(table.phone),
  ],
);

export const refresh_tokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: varchar('token_hash', { length: 512 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  deviceInfo: text('device_info'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const user_addresses = pgTable('user_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipientName: text('recipient_name').notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 15 }).notNull(),
  // dùng dữ liệu của việt nam
  province_code: text('province_code').notNull(),
  district_code: text('district_code').notNull(),
  ward_code: text('ward_code').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
});
/**
 *  special promo code,have limit and duration untirl expire
 */
export const promo_code = pgTable('promo_code', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  discountType: discountTypes('discount_type').notNull(),
  discountValue: integer('discount_value').notNull(),
  description: text('description'),
  limit: integer('limit').notNull(),
  used: integer('used').notNull().default(0),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Track promo code usage per user per order
 */
export const promo_usage = pgTable('promo_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  promoCodeId: uuid('promo_code_id')
    .references(() => promo_code.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  orderId: uuid('order_id')
    .references(() => customer_orders.id)
    .notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
/**
 * Categories - Hierarchical tree (e.g., Electronics > Smartphones > iPhone)
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    // FIXED: changed text('name') to text('normalize_name') to prevent DB column clash
    image: text('image'),
    slug: text('slug').unique().notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
    level: integer('level'),
    isDeleted: boolean('is_deleted').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('categories_parent_idx').on(table.parentId),
    index('categories_slug_idx').on(table.slug),
  ],
);

export const payment_methods = pgTable('payment_methods', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(), // 'vnpay', 'momo'
  name: text('name').notNull(), // 'Credit Card', 'Thanh toán khi nhận hàng'
  isActive: boolean('is_active').default(true),
  config: jsonb('config'), // Store provider-specific settings if needed
});

/**
 * Group attributes together. *eg:  Common attributes: Processor, Screen Size
 */
export const attribute_groups = pgTable('attribute_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').unique().notNull(),
  categoryId: uuid('category_id')
    .references(() => categories.id)
    .notNull(),
});

/**
 *  Attributes. eg: Processor, Screen Size
 */
export const attributes = pgTable(
  'attributes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(), // Removed .unique()
    type: varchar('type', { length: 32 }).notNull().default('text'),
    filterable: boolean('filterable').notNull().default(false),
    // for variant product ,.eg  color, size, storage
    isVariant: boolean('is_variant').notNull().default(false),
    unit: text('unit'),
    sortOrder: serial('sort_order'),
    groupId: uuid('group_id')
      .references(() => attribute_groups.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex('attributes_slug_groupId_idx').on(table.slug, table.groupId), // Composite unique index
  ],
);

/**
 *  Attribute options. eg: Processor = "A18 Pro", Screen Size = "6.9 inch"
 */
export const attribute_options = pgTable('attribute_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  attributeId: uuid('attribute_id')
    .references(() => attributes.id)
    .notNull(),
  value: text('value').notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
});

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 255 }).unique().notNull(),
    logo: text('logo'),
    description: text('description'),
    isDeleted: boolean('is_deleted').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('brands_slug_idx').on(table.slug)],
);

/** * BASE PRODUCT: The common container (e.g., "iPhone 17 Pro Max")
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // ADDED: Link the product to a category so it knows which attributes to use
    categoryId: uuid('category_id')
      .references(() => categories.id)
      .notNull(),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 255 }).unique().notNull(),
    description: jsonb('description').$type<any>(), // Rich text with formatting and media
    createdAt: timestamp('created_at').defaultNow().notNull(),
    brandId: uuid('brand_id').references(() => brands.id),
    seoMetadata: jsonb('seo_metadata').$type<{
      title?: string;
      description?: string;
      keywords?: string[];
      ogImage?: string;
    }>(),
    isDeleted: boolean('is_deleted').default(false),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('products_category_idx').on(table.categoryId),
    index('products_slug_idx').on(table.slug),
  ],
);

/** * COMMON ATTRIBUTES: Specs shared by ALL variants of this product.
 * Example: Processor = "A18 Pro", Screen Size = "6.9 inch"
 */
export const product_attribute_values = pgTable('product_attribute_values', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .references(() => products.id, {
      onDelete: 'cascade'
    })
    .notNull(),
  attributeId: uuid('attribute_id')
    .references(() => attributes.id, {
      onDelete: 'cascade'
    })
    .notNull(),

  // For text/number values (e.g., "A18 Pro")
  value: text('value'),

  // Optional: If the common attribute uses a predefined option
  optionId: uuid('option_id').references(() => attribute_options.id),
});

/** * VARIANTS (SKUs): The actual purchasable items (e.g., "256GB / Blue")
 */
export const product_variants = pgTable(
  'product_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .references(() => products.id, {
        onDelete: 'cascade'
      })
      .notNull(),
    sku: varchar('sku', { length: 255 }).notNull(),
    price: integer('price').notNull(), // Store as integer (cents or raw VND)
    stock: integer('stock').notNull().default(0),
    // name like for egs: iphone 17 pro max 256G CAM VŨ TRỤ
    name: text('name'),
  },
  (table) => [
    index('product_variants_product_idx').on(table.productId),
    index('product_variants_sku_idx').on(table.sku),
    // composite unique index
    uniqueIndex('product_variants_sku_productId_idx').on(
      table.sku,
      table.productId,
    ),
  ],
);

/**
 * Maps the SKU to specific options (e.g., Storage = 256GB, Color = Blue)
 */
export const variant_attribute_values = pgTable(
  'variant_attribute_values',
  {
    variantId: uuid('variant_id')
      .references(() => product_variants.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    attributeId: uuid('attribute_id')
      .references(() => attributes.id)
      .notNull(),
    optionId: uuid('option_id').references(() => attribute_options.id),
    value: text('value'),
  },
  (table) => [
    // Composite PK ensures a variant can only have ONE value per attribute (Can't be Blue AND Red)
    primaryKey({ columns: [table.variantId, table.attributeId] }),
  ],
);

/** * IMAGES: Shared pool of all images for a product
 */
export const product_images = pgTable('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .references(() => products.id, {
      onDelete: 'cascade'
    })
    .notNull(),
  url: text('url').notNull(),
  secureUrl: text('secure_url'),
  publicId: text('public_id'),
  isMain: boolean('is_main').notNull().default(false), // Main image for the overall product
  sortOrder: integer('sort_order').notNull().default(0),
});

/**
 * VARIANT IMAGES: Links a specific variant to one or more images in the product's global gallery.
 */
export const variant_images = pgTable(
  'variant_images',
  {
    variantId: uuid('variant_id')
      .references(() => product_variants.id, {
        onDelete: 'cascade'
      })
      .notNull(),
    imageId: uuid('image_id')
      .references(() => product_images.id, {
        onDelete: 'cascade'
      })
      .notNull(),
    // Let a variant pick its own "main" image from the shared pool
    isMain: boolean('is_main').notNull().default(false),
  },
  (table) => [
    // Composite PK ensures we don't link the same image to the same variant twice
    primaryKey({ columns: [table.variantId, table.imageId] }),
  ],
);
/**
 * Discount events
 */
// a parent of discount like it will belong in one group banner

export const discount_events_groups = pgTable('discount_events_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  order: integer(),
  bannerImage: text('banner_image'),
  isActive: boolean('is_active').notNull().default(true),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const discount_events = pgTable('discount_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: timestamp('start_date').notNull(),
  // end date is optional, mean it can be manual remove
  groupId: uuid('group_id').references(() => discount_events_groups.id),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
/**
 *  Product of discount events
 */
export const discount_event_products = pgTable('discount_event_products', {
  eventId: uuid('event_id')
    .references(() => discount_events.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  discountPercentage: integer('discount_percentage').notNull().default(0),
  // How many products are discounted
  stock: integer('stock').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 *  Customer cart
 */
export const customer_carts = pgTable('customer_carts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  variantId: uuid('variant_id')
    .references(() => product_variants.id)
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('cart_user_variant_idx').on(t.userId, t.variantId),
]);
/**
 * save customer order
 */
export const customer_orders = pgTable(
  'customer_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    promoCodeId: uuid('promo_code_id').references(() => promo_code.id),
    status: orderStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    total: integer('total').notNull().default(0),
    discountAmount: integer('discount_amount').notNull().default(0),
    shippingFee: integer('shipping_fee').notNull().default(0),

    // Snapshot of shipping info so past orders aren't affected if user modifies/deletes their address book
    shippingAddress: text('shipping_address'),
    shippingPhone: varchar('shipping_phone', { length: 15 }),
    shippingName: text('shipping_name'),
    provinceCode: text('province_code'),
    districtCode: text('district_code'),
    wardCode: text('ward_code'),
  },
  (table) => [
    index('orders_user_idx').on(table.userId),
    index('orders_status_idx').on(table.status),
  ],
);

/**
 * items of an order
 */
export const customer_orders_items = pgTable('customer_orders_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .references(() => customer_orders.id)
    .notNull(),
  variantId: uuid('variant_id')
    .references(() => product_variants.id)
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  price: integer('price').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Log every order status change
 */
export const order_logs = pgTable('order_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .references(() => customer_orders.id)
    .notNull(),
  fromStatus: orderStatus('from_status'),
  toStatus: orderStatus('to_status').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * payment of an order
 */
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .references(() => customer_orders.id)
    .notNull(),
  paymentMethodId: uuid('payment_method_id')
    .references(() => payment_methods.id)
    .notNull(),
  amount: integer('amount').notNull().default(0),
  status: paymentStatus('status').notNull().default('pending'),
  transactionId: text('transaction_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * save every action
 */
export const payment_transaction_logs = pgTable('payment_transaction_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Liên kết với record thanh toán tổng
  paymentId: uuid('payment_id')
    .references(() => payments.id)
    .notNull(),

  // Hành động/Sự kiện (vd: 'initiate', 'webhook_success', 'webhook_failed', 'refund', 'user_cancel')
  action: varchar('action', { length: 50 }).notNull(),

  // Trạng thái tại thời điểm ghi log (vd: 'pending', 'success', 'failed')
  status: varchar('status', { length: 50 }).notNull(),

  // Mã giao dịch từ đối tác/cổng thanh toán (Stripe charge ID, VNPay vnp_TransactionNo)
  providerTransactionId: text('provider_transaction_id'),

  // Lưu trữ raw data gửi đi (Request) hoặc nhận về từ Webhook (Response) để debug và đối soát
  payload: jsonb('payload'),

  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
// ─── RELATIONS ──────────────────────────────────────────────────

export const userRelations = relations(users, ({ one, many }) => ({
  addresses: many(user_addresses),
  carts: many(customer_carts),
  orders: many(customer_orders),
  promoUsages: many(promo_usage),
  refreshTokens: many(refresh_tokens),
}));

export const refreshTokensRelations = relations(refresh_tokens, ({ one }) => ({
  user: one(users, {
    fields: [refresh_tokens.userId],
    references: [users.id],
  }),
}));

export const userAddressesRelations = relations(user_addresses, ({ one }) => ({
  user: one(users, {
    fields: [user_addresses.userId],
    references: [users.id],
  }),
}));

export const promoCodeRelations = relations(promo_code, ({ many }) => ({
  usages: many(promo_usage),
  orders: many(customer_orders),
}));

export const promoUsageRelations = relations(promo_usage, ({ one }) => ({
  promoCode: one(promo_code, {
    fields: [promo_usage.promoCodeId],
    references: [promo_code.id],
  }),
  user: one(users, {
    fields: [promo_usage.userId],
    references: [users.id],
  }),
  order: one(customer_orders, {
    fields: [promo_usage.orderId],
    references: [customer_orders.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryParent',
  }),
  children: many(categories, { relationName: 'categoryParent' }),
  attributeGroups: many(attribute_groups),
  products: many(products),
}));

export const attributeGroupsRelations = relations(
  attribute_groups,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [attribute_groups.categoryId],
      references: [categories.id],
    }),
    attributes: many(attributes),
  }),
);

export const attributesRelations = relations(attributes, ({ one, many }) => ({
  group: one(attribute_groups, {
    fields: [attributes.groupId],
    references: [attribute_groups.id],
  }),
  options: many(attribute_options),
  productAttributeValues: many(product_attribute_values),
  variantAttributeValues: many(variant_attribute_values),
}));

export const attributeOptionsRelations = relations(
  attribute_options,
  ({ one, many }) => ({
    attribute: one(attributes, {
      fields: [attribute_options.attributeId],
      references: [attributes.id],
    }),
    productAttributeValues: many(product_attribute_values),
    variantAttributeValues: many(variant_attribute_values),
  }),
);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  attributeValues: many(product_attribute_values),
  variants: many(product_variants),
  images: many(product_images),
  discountEvents: many(discount_event_products),
  brands: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const productAttributeValuesRelations = relations(
  product_attribute_values,
  ({ one }) => ({
    product: one(products, {
      fields: [product_attribute_values.productId],
      references: [products.id],
    }),
    attribute: one(attributes, {
      fields: [product_attribute_values.attributeId],
      references: [attributes.id],
    }),
    option: one(attribute_options, {
      fields: [product_attribute_values.optionId],
      references: [attribute_options.id],
    }),
  }),
);

export const productVariantsRelations = relations(
  product_variants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [product_variants.productId],
      references: [products.id],
    }),
    attributeValues: many(variant_attribute_values),
    variantImages: many(variant_images),
    cartItems: many(customer_carts),
    orderItems: many(customer_orders_items),
  }),
);

export const variantAttributeValuesRelations = relations(
  variant_attribute_values,
  ({ one, many }) => ({
    variant: one(product_variants, {
      fields: [variant_attribute_values.variantId],
      references: [product_variants.id],
    }),
    attribute: one(attributes, {
      fields: [variant_attribute_values.attributeId],
      references: [attributes.id],
    }),
    option: one(attribute_options, {
      fields: [variant_attribute_values.optionId],
      references: [attribute_options.id],
    }),
  }),
);

export const productImagesRelations = relations(
  product_images,
  ({ one, many }) => ({
    product: one(products, {
      fields: [product_images.productId],
      references: [products.id],
    }),
    variantImages: many(variant_images),
  }),
);

export const variantImagesRelations = relations(variant_images, ({ one }) => ({
  variant: one(product_variants, {
    fields: [variant_images.variantId],
    references: [product_variants.id],
  }),
  image: one(product_images, {
    fields: [variant_images.imageId],
    references: [product_images.id],
  }),
}));

export const customer_cartsRelations = relations(customer_carts, ({ one }) => ({
  variant: one(product_variants, {
    fields: [customer_carts.variantId],
    references: [product_variants.id],
  }),
  user: one(users, {
    fields: [customer_carts.userId],
    references: [users.id],
  }),
}));

export const customerOrdersRelations = relations(
  customer_orders,
  ({ one, many }) => ({
    user: one(users, {
      fields: [customer_orders.userId],
      references: [users.id],
    }),
    promoCode: one(promo_code, {
      fields: [customer_orders.promoCodeId],
      references: [promo_code.id],
    }),
    items: many(customer_orders_items),
    payments: many(payments),
    promoUsage: many(promo_usage),
    logs: many(order_logs),
  }),
);

export const customerOrdersItemsRelations = relations(
  customer_orders_items,
  ({ one }) => ({
    order: one(customer_orders, {
      fields: [customer_orders_items.orderId],
      references: [customer_orders.id],
    }),
    variant: one(product_variants, {
      fields: [customer_orders_items.variantId],
      references: [product_variants.id],
    }),
  }),
);

export const orderLogsRelations = relations(order_logs, ({ one }) => ({
  order: one(customer_orders, {
    fields: [order_logs.orderId],
    references: [customer_orders.id],
  }),
}));

export const paymentMethodsRelations = relations(
  payment_methods,
  ({ many }) => ({
    payments: many(payments),
  }),
);

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(customer_orders, {
    fields: [payments.orderId],
    references: [customer_orders.id],
  }),
  paymentMethod: one(payment_methods, {
    fields: [payments.paymentMethodId],
    references: [payment_methods.id],
  }),
  transactionLogs: many(payment_transaction_logs),
}));

export const paymentTransactionLogsRelations = relations(
  payment_transaction_logs,
  ({ one }) => ({
    payment: one(payments, {
      fields: [payment_transaction_logs.paymentId],
      references: [payments.id],
    }),
  }),
);
export const discountEventsGroupsRelations = relations(
  discount_events_groups,
  ({ many }) => ({
    events: many(discount_events),
  }),
);

export const discountEventsRelations = relations(
  discount_events,
  ({ one, many }) => ({
    group: one(discount_events_groups, {
      fields: [discount_events.groupId],
      references: [discount_events_groups.id],
    }),
    products: many(discount_event_products),
  }),
);

export const discountEventProductsRelations = relations(
  discount_event_products,
  ({ one }) => ({
    event: one(discount_events, {
      fields: [discount_event_products.eventId],
      references: [discount_events.id],
    }),

    product: one(products, {
      fields: [discount_event_products.productId],
      references: [products.id],
    }),
  }),
);
