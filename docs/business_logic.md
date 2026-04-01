# Business Logic & Flows

> Tài liệu này mô tả **luồng nghiệp vụ và quy tắc xử lý** của hệ thống.  
> Schema reference: `schema.ts` · Cập nhật lần cuối: 2026-03

---

## Table of Contents

1. [Checkout Flow](#1-checkout-flow)
2. [Tính giá & Discount](#2-tính-giá--discount)
3. [Order Lifecycle](#3-order-lifecycle)
4. [Payment Flow](#4-payment-flow)
5. [Stock Management](#5-stock-management)
6. [Promo Code Rules](#6-promo-code-rules)
7. [Authentication Flow](#7-authentication-flow)
8. [Edge Cases & Gotchas](#8-edge-cases--gotchas)

---

## 1. Checkout Flow

Đây là luồng chính khi user bấm "Đặt hàng".

```
Cart  →  Validate  →  Tính giá  →  Tạo Order  →  Tạo Payment  →  Redirect
```

### Các bước chi tiết

```
1. Validate cart
   ├── Từng variant còn tồn tại và không bị xóa?
   ├── stock >= quantity yêu cầu? (kiểm tra từng item)
   └── Giá chưa thay đổi? (so sánh với product_variants.price)

2. Validate promo code (nếu có)
   ├── Tồn tại và is_active = true?
   ├── Trong khoảng start_date → end_date?
   ├── used < limit?
   └── User này đã dùng code này chưa? (xem promo_usage, tùy per-code config)

3. Tính toán giá → xem mục 2

4. Tạo order (transaction)
   ├── INSERT customer_orders (status = 'pending')
   ├── INSERT customer_orders_items (snapshot giá tại thời điểm này)
   ├── Trừ stock từng variant (product_variants.stock -= quantity)
   ├── Nếu có promo code: INSERT promo_usage + tăng promo_code.used += 1
   └── INSERT order_logs { from: null, to: 'pending' }

5. Tạo payment record
   └── INSERT payments { status: 'pending', payment_method_id }

6. Xóa các item đã order khỏi customer_carts

7. Redirect sang payment gateway (nếu online) hoặc confirm page (COD)
```

> ⚠️ **Bước 4 phải chạy trong một transaction duy nhất.** Nếu bất kỳ bước nào fail, rollback toàn bộ — đặc biệt là phần trừ stock và tăng promo.used.

---

## 2. Tính giá & Discount

### Công thức

```
subtotal        = Σ (item.price × item.quantity)
discount_event  = Σ discount từng item có trong discount_event_products
promo_discount  = tính trên (subtotal - discount_event)  ← áp sau
shipping_fee    = tính riêng (theo địa chỉ / đơn vị vận chuyển)

total = subtotal - discount_event - promo_discount + shipping_fee
```

### Discount Event

- Áp dụng **theo từng sản phẩm** (`discount_event_products.discount_percentage`)
- Một sản phẩm có thể thuộc nhiều event cùng lúc → **lấy % cao nhất** *(hoặc cộng dồn — cần confirm)*
- Chỉ áp dụng nếu event đang active: `start_date <= now <= end_date`
- Event có `stock` riêng — nếu `discount_event_products.stock = 0` thì không còn giá khuyến mãi dù event vẫn đang chạy

### Promo Code

- Áp dụng **sau khi đã tính discount event**
- `discount_type = 'percentage'`: `promo_discount = (subtotal - discount_event) × value / 100`
- `discount_type = 'fixed'`: `promo_discount = value` (VND cố định)
- Promo code và discount event **có thể dùng đồng thời** (promo code là voucher đặc biệt phát riêng)

### Ví dụ minh họa

```
Sản phẩm A: 10.000.000đ, đang flash sale -20%
Sản phẩm B: 5.000.000đ, không có event

subtotal        = 15.000.000
discount_event  = 10.000.000 × 20% = 2.000.000
after_event     = 13.000.000

Promo SAVE10 (10% fixed):
promo_discount  = 13.000.000 × 10% = 1.300.000

shipping_fee    = 30.000

total = 15.000.000 - 2.000.000 - 1.300.000 + 30.000 = 11.730.000đ
```

---

## 3. Order Lifecycle

### Trạng thái và transition hợp lệ

```
                    ┌─────────────┐
         ┌─────────▶│  cancelled  │◀────────────────────┐
         │          └─────────────┘                      │
         │                                               │
    [pending] ──▶ [processing] ──▶ [shipped] ──▶ [delivered]
```

| From | To | Ai trigger | Điều kiện |
|------|----|-----------|-----------|
| `pending` | `processing` | Admin / hệ thống | Payment thành công (online) hoặc xác nhận COD |
| `pending` | `cancelled` | User hoặc Admin | Trước khi processing |
| `processing` | `shipped` | Admin | Đã bàn giao cho đơn vị vận chuyển |
| `processing` | `cancelled` | Admin | Hết hàng hoặc lý do đặc biệt |
| `shipped` | `delivered` | Admin / webhook | Xác nhận giao thành công |
| `shipped` | `cancelled` | Admin | Trường hợp đặc biệt (hoàn hàng trước khi nhận) |

> **Không được phép:** `delivered` → bất kỳ trạng thái nào khác (đơn đã hoàn tất).

### Ghi order_logs

Mỗi lần transition phải INSERT một row vào `order_logs`:

```ts
{
  order_id:    <id>,
  from_status: <trạng thái trước>,   // null nếu là lần đầu
  to_status:   <trạng thái mới>,
  note:        <lý do, tùy chọn>,
  created_at:  now()
}
```

`order_logs` là **append-only** — không update, không delete.

### Hoàn stock khi hủy đơn

Khi order chuyển sang `cancelled`:
- Cộng lại stock: `product_variants.stock += item.quantity` cho từng item
- Nếu đã có `promo_usage`: **không xóa** record, nhưng cần trừ lại `promo_code.used -= 1`
- Nếu payment đã `success`: phát sinh luồng hoàn tiền riêng

---

## 4. Payment Flow

### COD (Thanh toán khi nhận hàng)

```
Tạo order (pending)
    └── payments.status = 'pending'
         └── Admin xác nhận đơn → order = 'processing'
              └── Giao hàng thành công → payments.status = 'success'
                                       → order = 'delivered'
```
### Trạng thái hợp lệ

Các trạng thái của một record `payments` được định nghĩa trong `paymentStatus` enum:

| Trạng thái | Ý nghĩa | Ghi chú |
|------------|---------|---------|
| `pending` | Đang chờ thanh toán | Trạng thái mặc định khi vừa tạo đơn. |
| `success` | Thanh toán thành công | Đã nhận được tiền/xác nhận từ gateway hoặc Admin. |
| `failed` | Thanh toán thất bại | Lỗi từ phía gateway hoặc thẻ không đủ tiền. |
| `expired` | Hết hạn | Link thanh toán quá hạn (ví dụ: sau 15-30 phút). |
| `cancelled`| Người dùng hủy | User chủ động hủy giao dịch tại trang thanh toán. |
| `refunded` | Đã hoàn tiền | Tiền đã được trả lại toàn bộ cho khách hàng. |
| `partial_refunded` | Hoàn tiền một phần | Chỉ hoàn trả một phần số tiền (ví dụ: khi khách trả lại 1 vài món trong đơn). |
### Online Payment (VNPay / MoMo)

```
Tạo order (pending)
    └── payments.status = 'pending'
         └── Redirect sang gateway
              ├── [Thành công] Webhook về → payments.status = 'success'
              │                           → order = 'processing'
              │                           → INSERT payment_transaction_logs
              └── [Thất bại / Timeout]   → payments.status = 'failed'
                                         → order = 'cancelled'
                                         → Hoàn stock
                                         → INSERT payment_transaction_logs
```

### Ghi payment_transaction_logs

Ghi log tại **mọi sự kiện** liên quan đến payment:

| action | Khi nào |
|--------|---------|
| `initiate` | Vừa tạo payment, chuẩn bị redirect |
| `webhook_success` | Nhận webhook thành công từ gateway |
| `webhook_failed` | Nhận webhook thất bại |
| `user_cancel` | User chủ động hủy trên trang gateway |
| `timeout` | Quá thời gian chờ không nhận được webhook |
| `refund` | Hoàn tiền |

`payload` lưu **raw body** của request/response từ gateway — không filter, không transform.

---

## 5. Stock Management

### Thời điểm trừ stock

Stock được trừ **ngay khi tạo order** (`status = pending`), không chờ payment.

**Lý do:** Tránh oversell trong trường hợp nhiều user checkout cùng lúc. User đã "giữ chỗ" khi tạo đơn.

**Hệ quả cần xử lý:**
- Nếu payment thất bại / user không thanh toán → phải hoàn stock khi cancel
- Cần có cơ chế **auto-cancel** đơn pending quá X phút không thanh toán (cronjob)

### Race condition

Khi trừ stock phải dùng **atomic update** để tránh race condition:

```sql
UPDATE product_variants
SET stock = stock - :quantity
WHERE id = :variantId AND stock >= :quantity
```

Nếu `affected rows = 0` → hết hàng → rollback transaction → trả lỗi cho user.

### Discount event stock

`discount_event_products.stock` là số lượng sản phẩm **được hưởng giá khuyến mãi**, tách biệt với `product_variants.stock`. Khi một item được mua với giá event:
- Trừ `product_variants.stock` (hàng thật)
- Trừ `discount_event_products.stock` (slot khuyến mãi)

---

## 6. Promo Code Rules

### Validate trước khi áp dụng

```
1. code tồn tại trong DB?
2. is_active = true?
3. now >= start_date AND now <= end_date?
4. used < limit?
5. User này có được dùng lại không? (xem bên dưới)
```

### Giới hạn dùng lại per-user

Tùy cấu hình từng promo code — hiện tại schema chưa có cột `max_per_user`, nên logic này đang được handle ở tầng application:

| Config (ngầm định) | Logic kiểm tra |
|--------------------|---------------|
| Mỗi user chỉ dùng 1 lần | `SELECT COUNT(*) FROM promo_usage WHERE user_id = ? AND promo_code_id = ?` → nếu > 0 thì từ chối |
| Dùng nhiều lần | Chỉ kiểm tra `used < limit` |

> **TODO:** Cân nhắc thêm cột `max_per_user` vào bảng `promo_code` để config linh hoạt thay vì hardcode.

### Khi order bị hủy

- `promo_usage` record **giữ nguyên** (audit trail)
- `promo_code.used` **giảm 1** để user có thể dùng lại (nếu logic cho phép)

---

## 7. Authentication Flow

### Đăng nhập (Credentials)

```
POST /auth/login
    └── Tìm user theo email
         └── Verify password hash (bcrypt)
              └── Tạo access token (JWT, ~15 phút)
                + Tạo refresh token → INSERT refresh_tokens (hash)
                   └── Trả về { accessToken, refreshToken }
```

### Refresh Token

```
POST /auth/refresh
    └── Hash token nhận được → tìm trong refresh_tokens
         ├── Không tìm thấy / revoked_at != null / expires_at < now → 401
         └── Hợp lệ:
              ├── Revoke token cũ (UPDATE revoked_at = now())
              ├── Tạo access token mới
              ├── Tạo refresh token mới → INSERT refresh_tokens
              └── Trả về token mới (rotation)
```

### Đăng xuất

```
DELETE /auth/logout
    └── Hash refresh token → UPDATE refresh_tokens SET revoked_at = now()
```

Đăng xuất khỏi **tất cả thiết bị**:
```sql
UPDATE refresh_tokens SET revoked_at = now()
WHERE user_id = :userId AND revoked_at IS NULL
```

### OAuth (Google, v.v.)

```
Callback nhận được { provider, providerId, email }
    ├── Tìm user theo (provider, providerId) → uniqueIndex provider_idx
    │    └── Tìm thấy → đăng nhập bình thường
    └── Không tìm thấy
         ├── Email đã tồn tại (đăng ký bằng credentials trước đó)?
         │    └── Merge: cập nhật provider/providerId cho user cũ
         └── Hoàn toàn mới → INSERT users (passwordHash = null)
```

---

## 8. Edge Cases & Gotchas

### Checkout

| Tình huống | Xử lý |
|-----------|-------|
| Hết hàng sau khi user đã thêm vào cart | Bắt lỗi ở bước validate stock, trả về danh sách item không đủ hàng |
| Giá thay đổi giữa lúc thêm cart và lúc checkout | Dùng `product_variants.price` tại thời điểm checkout, không dùng giá cached trong cart |
| Promo code hết limit ngay lúc nhiều user submit cùng lúc | Dùng atomic update: `UPDATE promo_code SET used = used + 1 WHERE id = ? AND used < limit` — kiểm tra affected rows |
| Discount event hết slot khuyến mãi | Trả về giá gốc, vẫn cho phép mua |

### Payment

| Tình huống | Xử lý |
|-----------|-------|
| Webhook đến trùng lặp (idempotency) | Kiểm tra `transaction_id` trong `payments` trước khi xử lý — nếu đã có thì skip |
| Webhook đến sau khi order đã cancelled | Log vào `payment_transaction_logs`, không cập nhật order |
| User đóng tab trước khi redirect về | Cronjob auto-cancel đơn pending > X phút, hoàn stock |

### Dữ liệu

| Vấn đề | Lưu ý |
|--------|-------|
| `customer_orders_items.price` | Luôn snapshot tại thời điểm đặt hàng — không join về `product_variants.price` để tính lại |
| `customer_orders.shippingAddress` | Snapshot chuỗi địa chỉ đầy đủ — không join về `user_addresses` |
| Soft delete `categories` / `brands` | Khi `is_deleted = true`, sản phẩm thuộc danh mục đó vẫn tồn tại — cần filter ở tầng query |

---

> **Ghi chú:** Những chỗ đánh dấu `TODO` hoặc *"cần confirm"* là các quyết định chưa được ghi lại chính thức — nên giải quyết trước khi production.