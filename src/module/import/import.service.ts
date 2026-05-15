import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    type DB,
    DRIZZLE,
    type Transaction,
} from 'src/database/dizzle.provider';
import { and, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import CreateImportDto, {
    CreateImportItemDto,
    CreateImportWithItemsDto,
} from './dto/create-import.dto';
import {
    UpdateImportDto,
    UpdateImportItemDto,
    UpdateImportWithItemsDto,
} from './dto/update-import.dto';
import {
    import_order_items,
    import_orders,
    product_variants,
} from 'src/database/schema';
import {
    GetImportDetailResponseDto,
    GetImportQueryDto,
} from './dto/get-import.dto';
@Injectable()
export class ImportService {
    constructor(@Inject(DRIZZLE) private readonly db: DB) { }
    private readonly validStatusTransitions: Record<string, string[]> = {
        draft: [
            'draft',
            'pending',
            'processing',
            'in_transit',
            'partially_received',
            'completed',
            'cancelled',
        ],
        pending: [
            'pending',
            'processing',
            'in_transit',
            'partially_received',
            'completed',
            'cancelled',
        ],
        processing: [
            'processing',
            'in_transit',
            'partially_received',
            'completed',
            'cancelled',
        ],
        in_transit: [
            'in_transit',
            'partially_received',
            'completed',
            'cancelled',
            'returned',
        ],
        partially_received: [
            'partially_received',
            'completed',
            'cancelled',
            'returned',
        ],
        completed: ['completed'],
        cancelled: ['cancelled'],
        returned: ['returned'],
    };

    private readonly lockedStatuses = ['completed', 'cancelled', 'returned'];

    private validateStateTransition(
        currentStatus: string,
        newStatus?: string,
        isEditingItems = false,
    ) {
        if (newStatus && currentStatus !== newStatus) {
            const allowed = this.validStatusTransitions[currentStatus] || [];
            if (!allowed.includes(newStatus)) {
                throw new BadRequestException(
                    `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
                );
            }
        }
    }

    async createImport(importDto: CreateImportDto, tx?: Transaction) {
        const db = tx || this.db;
        const [data] = await db.insert(import_orders).values(importDto).returning();
        return data;
    }

    async createImportItem(
        importOrderId: string,
        importItemDto: CreateImportItemDto,
        tx?: Transaction,
    ) {
        const db = tx || this.db;
        const [data] = await db
            .insert(import_order_items)
            .values({ ...importItemDto, importOrderId })
            .returning();
        return data;
    }
    /**
     * Like it name reduce are rare case.
     */
    async increaseVariantQuantity(
        variantId: string,
        quantity: number,
        tx?: Transaction,
    ) {
        const db = tx || this.db;
        const [data] = await db
            .update(product_variants)
            .set({ stock: sql`${product_variants.stock} + ${quantity}` })
            .where(eq(product_variants.id, variantId))
            .returning();
        return data;
    }

    async createImportWithItems(dto: CreateImportWithItemsDto) {
        const { items, ...importData } = dto;
        return this.db.transaction(async (tx) => {
            const importOrder = await this.createImport(importData, tx);
            const importItems = await Promise.all(
                items.map((item) => this.createImportItem(importOrder.id, item, tx)),
            );
            return { importOrder, importItems };
        });
    }

    async updateStatus(id: string, status: any, tx?: Transaction) {
        const db = tx || this.db;
        const current = await db.query.import_orders.findFirst({
            where: eq(import_orders.id, id),
        });
        if (!current) throw new NotFoundException(`Import order ${id} not found`);
        this.validateStateTransition(current.status, status, false);

        if (current.status === status) return current;
        const [data] = await db
            .update(import_orders)
            .set({ status })
            .where(eq(import_orders.id, id))
            .returning();
        return data;
    }

    async updateImport(id: string, importDto: UpdateImportDto, tx?: Transaction) {
        const db = tx || this.db;
        const [data] = await db
            .update(import_orders)
            .set(importDto)
            .where(eq(import_orders.id, id))
            .returning();
        return data;
    }

    async updateImportItem(
        id: string,
        importItemDto: UpdateImportItemDto,
        tx?: Transaction,
    ) {
        const db = tx || this.db;
        const [data] = await db
            .update(import_order_items)
            .set({ ...importItemDto, updatedAt: new Date() })
            .where(eq(import_order_items.id, id))
            .returning();
        return data;
    }

    async updateImportWithItems(id: string, dto: UpdateImportWithItemsDto) {
        const { items, status, ...importData } = dto;
        const current = await this.db.query.import_orders.findFirst({
            where: eq(import_orders.id, id),
            with: { items: true },
        });

        if (!current) throw new NotFoundException(`Import order ${id} not found`);

        const isEditingItems =
            Object.keys(importData).length > 0 || items !== undefined;
        this.validateStateTransition(current.status, status, isEditingItems);
        const receive_item = current.items?.filter(
            (item) => item.receivedQuantity > 0,
        );
        const is_missing_receive = receive_item?.some(
            (old) => !items.map((e) => e.variantId).includes(old.variantId),
        );

        if (is_missing_receive) {
            throw new BadRequestException(
                `Cannot remove items from import order ${id} that have already been received`,
            );
        }
        const is_illegal_current_receive = items.some((item) => {
            const oldItem = receive_item?.find((old) => old.variantId === item.variantId);
            const oldReceived = oldItem ? oldItem.receivedQuantity : 0;
            return (item.receivedQuantity || 0) < oldReceived;
        });

        if (is_illegal_current_receive) {
            throw new BadRequestException(
                `Cannot reduce the received quantity of any existing items in the order`,
            );
        }

        return this.db.transaction(async (tx) => {
            const updatePayload: any = { ...importData };
            if (status) updatePayload.status = status;

            const importOrder = Object.keys(updatePayload).length
                ? await this.updateImport(id, updatePayload, tx)
                : current;
            let importItems: any[] | undefined = undefined;

            if (items !== undefined) {
                await tx
                    .delete(import_order_items)
                    .where(eq(import_order_items.importOrderId, id));

                if (items.length > 0) {
                    importItems = await Promise.all(
                        items.map(async (item) => {
                            const oldItem = current.items?.find(
                                (old) => old.variantId === item.variantId,
                            );
                            const oldReceivedQuantity = oldItem
                                ? oldItem.receivedQuantity
                                : 0;

                            let newReceivedQuantity = item.receivedQuantity || 0;
                            const targetStatus = status || current.status;

                            // Lax enforcement: if not in a status that allows receiving, ignore the payload and keep DB value
                            if (targetStatus !== 'partially_received' && targetStatus !== 'completed') {
                                newReceivedQuantity = oldReceivedQuantity;
                            } else if (targetStatus === 'completed') {
                                newReceivedQuantity = item.quantity;
                            }

                            if (newReceivedQuantity > item.quantity) {
                                throw new BadRequestException(
                                    `Cannot receive more items (${newReceivedQuantity}) than ordered (${item.quantity}) for variant ${item.variantId}`
                                );
                            }

                            const diff = newReceivedQuantity - oldReceivedQuantity;
                            if (diff > 0) {
                                await this.increaseVariantQuantity(item.variantId, diff, tx);
                            } else if (diff < 0) {
                                throw new BadRequestException(
                                    `Cannot reduce received quantity for variant ${item.variantId}`,
                                );
                            }

                            return this.createImportItem(
                                id,
                                { ...item, receivedQuantity: newReceivedQuantity },
                                tx,
                            );
                        }),
                    );
                }
            } else if (status === 'completed') {
                if (current.items && current.items.length > 0) {
                    await Promise.all(
                        current.items.map(async (oldItem) => {
                            const diff = oldItem.quantity - oldItem.receivedQuantity;
                            if (diff > 0) {
                                await this.increaseVariantQuantity(oldItem.variantId, diff, tx);
                                await this.updateImportItem(
                                    oldItem.id,
                                    { receivedQuantity: oldItem.quantity },
                                    tx,
                                );
                            }
                        }),
                    );
                }
            }

            return { importOrder, importItems };
        });
    }

    async getImports(query: GetImportQueryDto) {
        const { limit, offset, status, from, to } = query;

        const conditions: SQL[] = [];
        if (status) conditions.push(eq(import_orders.status, status));
        if (from) conditions.push(gte(import_orders.createdAt, new Date(from)));
        if (to) conditions.push(lte(import_orders.createdAt, new Date(to)));

        const whereCondition =
            conditions.length > 0 ? and(...conditions) : undefined;

        const totalSubquery = sql<number>`
        COALESCE((
            SELECT SUM(oi."quantity" * oi."price")
            FROM "import_order_items" oi
            WHERE oi."import_order_id" = "import_orders"."id"
        ), 0)
    `.as('total');

        const [data, [{ count }]] = await Promise.all([
            this.db
                .select({
                    id: import_orders.id,
                    status: import_orders.status,
                    createdAt: import_orders.createdAt,
                    updatedAt: import_orders.updatedAt,
                    total: totalSubquery,
                })
                .from(import_orders)
                .where(whereCondition)
                .orderBy(desc(import_orders.createdAt))
                .limit(limit)
                .offset(offset),

            this.db
                .select({ count: sql<number>`COUNT(*)::int` })
                .from(import_orders)
                .where(whereCondition),
        ]);

        return { count, data };
    }

    async getImportById(id: string): Promise<GetImportDetailResponseDto> {
        const data = await this.db.query.import_orders.findFirst({
            where: eq(import_orders.id, id),
            with: {
                items: {
                    with: {
                        variant: {
                            columns: {
                                id: true,
                                sku: true,
                                name: true,
                                price: true,
                            },
                        },
                    },
                },
                logs: {
                    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
                },
            },
        });

        if (!data) {
            throw new NotFoundException(`Import order ${id} not found`);
        }
        //@ts-ignore
        return data;
    }
}
