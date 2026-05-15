import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import {
    import_orders,
    import_order_items,
    import_order_logs,
    importOrderStatus,
} from 'src/database/schema';
import { IPaginatedRes } from 'src/types/IPaginatedRes';
import { paginateSchema } from 'src/common/dto/paginate.dto';

const dateStringSchema = z.preprocess(
    (val) => (val instanceof Date ? val.toISOString() : val),
    z.string().datetime(),
);
export const selectImportOrderSchema = createSelectSchema(import_orders)
    .omit({ createdAt: true, updatedAt: true })
    .extend({
        createdAt: dateStringSchema,
        updatedAt: dateStringSchema,
        status: z.enum([
            'draft', 'pending', 'processing', 'in_transit',
            'partially_received', 'completed', 'cancelled', 'returned',
        ]),
    });

export const selectImportItemSchema = createSelectSchema(import_order_items)
    .omit({ createdAt: true, updatedAt: true })
    .extend({
        createdAt: dateStringSchema,
        updatedAt: dateStringSchema,
        quantity: z.number().int().positive(),
        receivedQuantity: z.number().int().min(0),
        price: z.number().positive(),
    });

export const selectImportLogSchema = createSelectSchema(import_order_logs)
    .omit({ createdAt: true })
    .extend({
        createdAt: dateStringSchema,
        fromStatus: z.enum([
            'draft', 'pending', 'processing', 'in_transit',
            'partially_received', 'completed', 'cancelled', 'returned',
        ]).nullable(),
        toStatus: z.enum([
            'draft', 'pending', 'processing', 'in_transit',
            'partially_received', 'completed', 'cancelled', 'returned',
        ]),
        note: z.string().nullable(),
    });

// Variant snapshot trong item detail
const variantSnapshotSchema = z.object({
    id: z.string().uuid(),
    sku: z.string(),
    name: z.string().nullable(),
    price: z.number(),
});

// ─── Query DTO ─────────────────────────────────────────────────────────────
const getImportQuerySchema = paginateSchema.extend({
    status: z.enum([
        'draft', 'pending', 'processing', 'in_transit',
        'partially_received', 'completed', 'cancelled', 'returned',
    ]).optional(),
    // filter theo ngày tạo
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});

export class GetImportQueryDto extends createZodDto(getImportQuerySchema) { }

// Chỉ trả fields cần thiết cho table list, không kèm items/logs
export const importOrderListItemSchema = selectImportOrderSchema.pick({
    id: true,
    status: true,
    createdAt: true,
    updatedAt: true,
}).extend({
    total: z.number().nonnegative(),
});

export class GetImportListResponseDto extends createZodDto(importOrderListItemSchema) { }

// ─── Detail Response (Rich) ────────────────────────────────────────────────
const getImportDetailResponseSchema = selectImportOrderSchema.extend({
    items: z.array(
        selectImportItemSchema.extend({
            variant: variantSnapshotSchema.nullable(),
        })
    ),
    logs: z.array(selectImportLogSchema),
});

export class GetImportDetailResponseDto extends createZodDto(getImportDetailResponseSchema) { }

// ─── Paginated List Response ───────────────────────────────────────────────
const paginatedGetImportResponseSchema: z.ZodType<
    IPaginatedRes<GetImportListResponseDto>
> = z.object({
    count: z.number().int().nonnegative(),
    data: z.array(importOrderListItemSchema),
});

export class PaginatedGetImportResponseDto extends createZodDto(
    paginatedGetImportResponseSchema,
) { }