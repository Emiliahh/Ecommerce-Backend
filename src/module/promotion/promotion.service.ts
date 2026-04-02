import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import {
  discount_events_groups,
  discount_events,
  discount_event_products,
  promo_code,
  products,
} from 'src/database/schema';
import { eq, and, sql, ilike, count, avg, sum, SQL } from 'drizzle-orm';
import {
  CreateEventGroupDto,
  UpdateEventGroupDto,
  GetEventGroupQueryDto,
} from './dto/event-group.dto';
import {
  CreateDiscountEventDto,
  UpdateDiscountEventDto,
  GetDiscountEventQueryDto,
} from './dto/discount-event.dto';
import {
  AddProductToEventDto,
  UpdateEventProductDto,
} from './dto/event-product.dto';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  GetPromoCodeQueryDto,
} from './dto/promo-code.dto';

@Injectable()
export class PromotionService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT GROUPS
  // ─────────────────────────────────────────────────────────────────────────────

  async getEventGroups(query: GetEventGroupQueryDto) {
    const { limit, offset, isActive } = query;
    const conditions: SQL[] = [];
    if (isActive !== undefined) {
      conditions.push(eq(discount_events_groups.isActive, isActive));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Get groups with event count
    const data = await this.db
      .select({
        id: discount_events_groups.id,
        name: discount_events_groups.name,
        description: discount_events_groups.description,
        order: discount_events_groups.order,
        bannerImage: discount_events_groups.bannerImage,
        isActive: discount_events_groups.isActive,
        startDate: discount_events_groups.startDate,
        endDate: discount_events_groups.endDate,
        createdAt: discount_events_groups.createdAt,
        updatedAt: discount_events_groups.updatedAt,
        eventsCount: count(discount_events.id),
      })
      .from(discount_events_groups)
      .leftJoin(
        discount_events,
        eq(discount_events.groupId, discount_events_groups.id),
      )
      .where(where)
      .groupBy(discount_events_groups.id)
      .orderBy(discount_events_groups.order)
      .limit(limit ?? 10)
      .offset(offset ?? 0);

    const countRes = await this.db
      .select({ count: sql`count(*)` })
      .from(discount_events_groups)
      .where(where);

    return { count: Number(countRes[0].count), data };
  }

  async getEventGroupById(id: string) {
    const group = await this.db.query.discount_events_groups.findFirst({
      where: eq(discount_events_groups.id, id),
      with: { events: true },
    });
    if (!group) throw new NotFoundException('Event group not found');
    return group;
  }

  async createEventGroup(dto: CreateEventGroupDto) {
    const [group] = await this.db
      .insert(discount_events_groups)
      .values({
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      })
      .returning();
    return group;
  }

  async updateEventGroup(id: string, dto: UpdateEventGroupDto) {
    await this.getEventGroupById(id);
    const setData: Record<string, any> = { updatedAt: new Date() };
    if (dto.name !== undefined) setData.name = dto.name;
    if (dto.description !== undefined) setData.description = dto.description;
    if (dto.order !== undefined) setData.order = dto.order;
    if (dto.bannerImage !== undefined) setData.bannerImage = dto.bannerImage;
    if (dto.isActive !== undefined) setData.isActive = dto.isActive;
    if (dto.startDate) setData.startDate = new Date(dto.startDate);
    if (dto.endDate) setData.endDate = new Date(dto.endDate);
    const [updated] = await this.db
      .update(discount_events_groups)
      .set(setData)
      .where(eq(discount_events_groups.id, id))
      .returning();
    return updated;
  }

  async deleteEventGroup(id: string) {
    await this.getEventGroupById(id);
    await this.db
      .delete(discount_events_groups)
      .where(eq(discount_events_groups.id, id));
    return { message: 'Deleted' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DISCOUNT EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /** Compute live/upcoming/ended status from dates + isActive flag */
  private computeEventStatus(
    startDate: Date,
    endDate: Date | null,
    isActive: boolean,
  ): 'live' | 'upcoming' | 'ended' {
    if (!isActive) return 'ended';
    const now = new Date();
    if (startDate > now) return 'upcoming';
    if (endDate && endDate < now) return 'ended';
    return 'live';
  }

  async getDiscountEvents(query: GetDiscountEventQueryDto) {
    const { limit, offset, groupId, status } = query;

    const conditions: SQL[] = [];
    if (groupId) conditions.push(eq(discount_events.groupId, groupId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const now = new Date();

    // Build result with aggregated stats from event products
    const rows = await this.db
      .select({
        id: discount_events.id,
        name: discount_events.name,
        description: discount_events.description,
        groupId: discount_events.groupId,
        startDate: discount_events.startDate,
        endDate: discount_events.endDate,
        isActive: discount_events.isActive,
        createdAt: discount_events.createdAt,
        updatedAt: discount_events.updatedAt,
        groupName: discount_events_groups.name,
        productsCount: count(discount_event_products.productId),
        avgDiscount: avg(discount_event_products.discountPercentage),
        stockTotal: sum(discount_event_products.stock),
      })
      .from(discount_events)
      .leftJoin(
        discount_events_groups,
        eq(discount_events.groupId, discount_events_groups.id),
      )
      .leftJoin(
        discount_event_products,
        eq(discount_event_products.eventId, discount_events.id),
      )
      .where(where)
      .groupBy(discount_events.id, discount_events_groups.name)
      .orderBy(discount_events.startDate)
      .limit(limit ?? 10)
      .offset(offset ?? 0);

    const data = rows
      .map((r) => ({
        ...r,
        groupName: r.groupName ?? null,
        productsCount: Number(r.productsCount ?? 0),
        avgDiscount: Math.round(Number(r.avgDiscount ?? 0)),
        stockTotal: Number(r.stockTotal ?? 0),
        // stockUsed would need order data – returning 0 for now
        stockUsed: 0,
        status: this.computeEventStatus(
          r.startDate,
          r.endDate ?? null,
          r.isActive,
        ),
      }))
      .filter((r) => !status || r.status === status);

    const countRes = await this.db
      .select({ count: sql`count(*)` })
      .from(discount_events)
      .where(where);

    return { count: Number(countRes[0].count), data };
  }

  async getDiscountEventById(id: string) {
    const event = await this.db.query.discount_events.findFirst({
      where: eq(discount_events.id, id),
      with: {
        products: {
          with: { product: { columns: { id: true, name: true, slug: true } } },
        },
        group: true,
      },
    });
    if (!event) throw new NotFoundException('Discount event not found');
    return {
      ...event,
      status: this.computeEventStatus(
        event.startDate,
        event.endDate ?? null,
        event.isActive,
      ),
    };
  }

  async createDiscountEvent(dto: CreateDiscountEventDto) {
    const [event] = await this.db
      .insert(discount_events)
      .values({
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      })
      .returning();
    return event;
  }

  async updateDiscountEvent(id: string, dto: UpdateDiscountEventDto) {
    const event = await this.db.query.discount_events.findFirst({
      where: eq(discount_events.id, id),
    });
    if (!event) throw new NotFoundException('Discount event not found');
    const setData: Record<string, any> = { updatedAt: new Date() };
    if (dto.name !== undefined) setData.name = dto.name;
    if (dto.description !== undefined) setData.description = dto.description;
    if (dto.groupId !== undefined) setData.groupId = dto.groupId;
    if (dto.isActive !== undefined) setData.isActive = dto.isActive;
    if (dto.startDate) setData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined)
      setData.endDate = dto.endDate ? new Date(dto.endDate) : null;
    const [updated] = await this.db
      .update(discount_events)
      .set(setData)
      .where(eq(discount_events.id, id))
      .returning();
    return updated;
  }

  async deleteDiscountEvent(id: string) {
    const event = await this.db.query.discount_events.findFirst({
      where: eq(discount_events.id, id),
    });
    if (!event) throw new NotFoundException('Discount event not found');
    await this.db
      .delete(discount_events)
      .where(eq(discount_events.id, id));
    return { message: 'Deleted' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT PRODUCTS
  // ─────────────────────────────────────────────────────────────────────────────

  async getEventProducts(eventId: string) {
    return this.db.query.discount_event_products.findMany({
      where: eq(discount_event_products.eventId, eventId),
      with: { product: { columns: { id: true, name: true, slug: true } } },
    });
  }

  async addProductToEvent(eventId: string, dto: AddProductToEventDto) {
    // Check event exists
    const event = await this.db.query.discount_events.findFirst({
      where: eq(discount_events.id, eventId),
    });
    if (!event) throw new NotFoundException('Discount event not found');

    // Check product exists
    const product = await this.db.query.products.findFirst({
      where: eq(products.id, dto.productId),
    });
    if (!product) throw new NotFoundException('Product not found');

    // Check duplicate
    const existing = await this.db.query.discount_event_products.findFirst({
      where: and(
        eq(discount_event_products.eventId, eventId),
        eq(discount_event_products.productId, dto.productId),
      ),
    });
    if (existing)
      throw new ConflictException('Product already in this event');

    const [row] = await this.db
      .insert(discount_event_products)
      .values({ eventId, ...dto })
      .returning();
    return row;
  }

  async updateEventProduct(
    eventId: string,
    productId: string,
    dto: UpdateEventProductDto,
  ) {
    const existing = await this.db.query.discount_event_products.findFirst({
      where: and(
        eq(discount_event_products.eventId, eventId),
        eq(discount_event_products.productId, productId),
      ),
    });
    if (!existing) throw new NotFoundException('Event product not found');

    const [updated] = await this.db
      .update(discount_event_products)
      .set({ ...dto, updatedAt: new Date() })
      .where(
        and(
          eq(discount_event_products.eventId, eventId),
          eq(discount_event_products.productId, productId),
        ),
      )
      .returning();
    return updated;
  }

  async removeProductFromEvent(eventId: string, productId: string) {
    const existing = await this.db.query.discount_event_products.findFirst({
      where: and(
        eq(discount_event_products.eventId, eventId),
        eq(discount_event_products.productId, productId),
      ),
    });
    if (!existing) throw new NotFoundException('Event product not found');

    await this.db
      .delete(discount_event_products)
      .where(
        and(
          eq(discount_event_products.eventId, eventId),
          eq(discount_event_products.productId, productId),
        ),
      );
    return { message: 'Removed' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROMO CODES
  // ─────────────────────────────────────────────────────────────────────────────

  private computePromoStatus(
    isActive: boolean,
    used: number,
    limit: number,
    endDate: Date,
  ): 'active' | 'inactive' | 'exhausted' | 'expired' {
    if (endDate < new Date()) return 'expired';
    if (!isActive) return 'inactive';
    if (used >= limit) return 'exhausted';
    return 'active';
  }

  async getPromoCodes(query: GetPromoCodeQueryDto) {
    const { limit, offset, discountType, status, search } = query;

    const conditions: SQL[] = [];
    if (discountType)
      conditions.push(eq(promo_code.discountType, discountType));
    if (search)
      conditions.push(ilike(promo_code.code, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db.query.promo_code.findMany({
      where,
      limit: limit ?? 10,
      offset: offset ?? 0,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    let data = rows.map((r) => ({
      ...r,
      status: this.computePromoStatus(
        r.isActive,
        r.used,
        r.limit,
        r.endDate,
      ),
    }));

    // Post-filter by computed status if requested
    if (status) data = data.filter((r) => r.status === status);

    const countRes = await this.db
      .select({ count: sql`count(*)` })
      .from(promo_code)
      .where(where);

    return { count: Number(countRes[0].count), data };
  }

  async getPromoCodeById(id: string) {
    const code = await this.db.query.promo_code.findFirst({
      where: eq(promo_code.id, id),
    });
    if (!code) throw new NotFoundException('Promo code not found');
    return {
      ...code,
      status: this.computePromoStatus(
        code.isActive,
        code.used,
        code.limit,
        code.endDate,
      ),
    };
  }

  async createPromoCode(dto: CreatePromoCodeDto) {
    // Check code uniqueness
    const existing = await this.db.query.promo_code.findFirst({
      where: eq(promo_code.code, dto.code.toUpperCase()),
    });
    if (existing) throw new ConflictException('Promo code already exists');

    const [code] = await this.db
      .insert(promo_code)
      .values({
        ...dto,
        code: dto.code.toUpperCase(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      })
      .returning();
    return code;
  }

  async updatePromoCode(id: string, dto: UpdatePromoCodeDto) {
    await this.getPromoCodeById(id);
    const setData: Record<string, any> = { updatedAt: new Date() };
    if (dto.code) setData.code = dto.code.toUpperCase();
    if (dto.discountType !== undefined) setData.discountType = dto.discountType;
    if (dto.discountValue !== undefined) setData.discountValue = dto.discountValue;
    if (dto.description !== undefined) setData.description = dto.description;
    if (dto.limit !== undefined) setData.limit = dto.limit;
    if (dto.isActive !== undefined) setData.isActive = dto.isActive;
    if (dto.startDate) setData.startDate = new Date(dto.startDate);
    if (dto.endDate) setData.endDate = new Date(dto.endDate);
    const [updated] = await this.db
      .update(promo_code)
      .set(setData)
      .where(eq(promo_code.id, id))
      .returning();
    return updated;
  }

  async deletePromoCode(id: string) {
    await this.getPromoCodeById(id);
    await this.db.delete(promo_code).where(eq(promo_code.id, id));
    return { message: 'Deleted' };
  }
}
