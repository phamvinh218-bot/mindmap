# Mindmap cá nhân

Web vẽ mindmap cho riêng mình, khóa bằng mật khẩu, share từng mindmap bằng link có mật khẩu riêng (chỉ xem / được sửa).

- Thiết kế: [docs/superpowers/specs/2026-11-09-mindmap-design.md](docs/superpowers/specs/2026-11-09-mindmap-design.md)
- Kế hoạch triển khai: [docs/superpowers/plans/2026-11-09-mindmap-web.md](docs/superpowers/plans/2026-11-09-mindmap-web.md)

Công nghệ: Next.js 16 · React Flow · Supabase (Postgres) · Vercel. Tất cả đều dùng gói miễn phí.

## Chạy ở máy

```bash
npm install
cp .env.example .env.local
npm run hash-password      # nhập mật khẩu, dán kết quả vào OWNER_PASSWORD_HASH
npm run dev
```

Nếu để trống `SUPABASE_URL`, web dùng bộ nhớ tạm. Dữ liệu sẽ mất khi tắt server, nên chế độ này chỉ dùng để thử.

`SESSION_SECRET` là một chuỗi ngẫu nhiên dài ít nhất 32 ký tự, tạo bằng:

```bash
node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"
```

> `OWNER_PASSWORD_HASH` có dạng `b64:...`. Hãy dán nguyên giá trị đó. Nếu dán mã bcrypt gốc (bắt đầu bằng `$2b$`), Next.js sẽ hiểu các dấu `$` là tên biến và làm hỏng mã.

## Kiểm thử

```bash
npm test                   # unit + API (Vitest)
npx next build
npm run test:e2e           # Playwright, chạy trên bản build, bộ nhớ tạm
```

## Đưa lên mạng

### 1. Supabase

1. Tạo một project miễn phí.
2. Mở **SQL Editor**, chạy toàn bộ file [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
3. Vào **Project Settings → API**, lấy hai giá trị:
   - **Project URL** dùng cho `SUPABASE_URL`
   - **service_role key** dùng cho `SUPABASE_SERVICE_ROLE_KEY`. Khóa này là bí mật: chỉ dán vào Vercel, không đưa vào code.

Trình duyệt không bao giờ gọi trực tiếp tới Supabase. Mọi bảng đều bật RLS và không có policy nào, nên dù lộ anon key cũng không đọc được dữ liệu.

### 2. Vercel

1. Import repo GitHub vào Vercel.
2. Thêm các biến môi trường (Production):

| Biến | Giá trị |
|---|---|
| `OWNER_PASSWORD_HASH` | kết quả của `npm run hash-password` (dạng `b64:...`) |
| `SESSION_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `CRON_SECRET` | chuỗi ngẫu nhiên. Vercel Cron tự gửi chuỗi này khi gọi `/api/cron/daily` |

3. Deploy. Từ đó, mỗi lần push lên `main`, Vercel tự deploy lại.

Cron mỗi ngày (khai báo trong [vercel.json](vercel.json)) truy cập nhẹ vào database để Supabase bản miễn phí không tự tạm dừng sau 7 ngày không có truy cập. Cron này cũng xóa các lần đăng nhập sai cũ.

### Đổi mật khẩu chủ

Chạy lại `npm run hash-password`, thay `OWNER_PASSWORD_HASH` trên Vercel, rồi redeploy.

## Dùng

- **Tab**: thêm ý con. **Enter**: thêm ý cùng cấp. **F2** hoặc double-click: sửa chữ. **Delete**: xóa.
- **Ctrl+Z / Ctrl+Shift+Z**: hoàn tác / làm lại. **Ctrl+S**: lưu ngay. Bình thường web tự lưu sau 1,5 giây.
- Kéo nền để di chuyển khung nhìn. **Shift+kéo** để chọn nhiều ý. Kéo một ý thả lên ý khác để chuyển nhánh.
- **Nối**: chọn một ý, bấm Nối, rồi bấm ý đích. Hoặc kéo từ chấm xanh dưới ý. Chọn đường nối để đổi màu hoặc kéo chỉnh độ cong.
- **Chia sẻ**: mỗi link có quyền và mật khẩu riêng. Đổi mật khẩu hoặc tắt link thì người đang dùng link đó bị đăng xuất ngay.
- Khi có người khác vừa lưu bản mới hơn, web báo và cho chọn: tải bản mới, lưu bản của mình thành bản sao, hoặc tải file JSON về máy.
