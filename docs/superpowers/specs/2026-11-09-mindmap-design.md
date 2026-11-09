# Web Mindmap cá nhân — Thiết kế

Ngày: 2026-11-09
Trạng thái: chờ anh duyệt

## 1. Mục đích và lý do

Anh cần một web vẽ mindmap cho riêng mình, mỗi mindmap là một dự án anh đang làm. Anh share từng mindmap cho partner để cùng xem và cùng chỉnh.

Hiện anh dùng MindMeister. Lý do tự làm:
- **Đơn giản hơn**: chỉ giữ những tính năng anh thật sự dùng.
- **Không tốn phí subscribe**: mọi dịch vụ chạy trên gói miễn phí.

Thành công nghĩa là anh bỏ được MindMeister: dựng mindmap dự án nhanh như trên đó, share cho partner bằng link có mật khẩu, partner sửa được mà không cần tạo tài khoản.

## 2. Mục tiêu / Không làm / Điều cấm kỵ

**Mục tiêu**
- Vẽ mindmap: nhánh cha–con, đường nối cong có mũi tên giữa hai ý bất kỳ, tô màu, đổi hình dạng ý, link một ý sang mindmap khác.
- Cả web khóa bằng mật khẩu của anh.
- Share từng mindmap bằng link, mỗi link có mật khẩu riêng và quyền "chỉ xem" hoặc "được sửa".
- Chi phí vận hành 0đ.

**Không làm (ít nhất ở bản đầu)**
- Đồng bộ trực tiếp kiểu Google Docs (thấy con trỏ, thấy người khác gõ).
- Nhiều tài khoản, đăng ký, đăng nhập Google.
- Ghi chú dài, icon, ảnh, file đính kèm, task, ngày hạn, bình luận.
- Nhập dữ liệu từ MindMeister. (Đây là quyết định của em; có thể làm sau nếu anh cần.)
- Ứng dụng di động riêng. Trên điện thoại chỉ cần xem được; sửa thì chủ yếu làm trên máy tính.

**Điều cấm kỵ (chạy được nhưng vẫn coi là hỏng)**
- Giao diện rối như MindMeister. Bỏ hết những gì không có trong danh sách mục tiêu.
- Người không có mật khẩu đọc được nội dung mindmap.
- Mất dữ liệu: một người lưu đè, xóa mất phần người kia vừa sửa mà không có cảnh báo.
- Phát sinh phí.

## 3. Ràng buộc (anh đã chốt)

- Web chạy trên **Vercel** (tài khoản của anh, gói Hobby miễn phí).
- Dữ liệu lưu trên **Supabase** (tài khoản của anh, gói Free).
- Code đẩy lên **GitHub** (tài khoản `phamvinh218-bot`). Vercel tự triển khai mỗi khi push lên `main`.
- Giao diện tiếng Việt.

**Hạn chế của gói miễn phí:** Supabase Free tự tạm dừng dự án nếu 7 ngày không có truy cập. Cách xử lý: thêm một Vercel Cron chạy mỗi ngày, gọi một endpoint đọc nhẹ vào database để dự án không bị dừng.

## 4. Truy cập và chia sẻ (anh đã duyệt)

### 4.1 Chủ sở hữu (anh)
- Chỉ có **một chủ** là anh. Không có màn hình đăng ký.
- Mở web là vào màn hình nhập mật khẩu. Nhập đúng thì vào trang danh sách mindmap.
- Mật khẩu chủ không lưu trong database. Chỉ lưu **bản băm bcrypt** trong biến môi trường Vercel `OWNER_PASSWORD_HASH`. Có script `npm run hash-password` để tạo bản băm. Muốn đổi mật khẩu thì đổi biến môi trường rồi redeploy.
- Đăng nhập xong, web cấp một cookie phiên đã ký (JWT HS256, ký bằng `SESSION_SECRET`), đặt httpOnly, Secure, SameSite=Lax, hạn 30 ngày.
- Có nút đăng xuất.
- Chỉ chủ được tạo, đổi tên, xóa mindmap và quản lý link share.

### 4.2 Link share
- Mỗi mindmap có thể có **nhiều link share**, ví dụ mỗi partner một link.
- Một link share gồm:
  - token ngẫu nhiên khó đoán (32 byte, base64url), URL dạng `/s/<token>`
  - quyền: `view` (chỉ xem) hoặc `edit` (được sửa)
  - mật khẩu riêng do anh đặt, lưu dạng băm bcrypt
  - nhãn tùy chọn để anh nhận ra link, ví dụ "Partner Minh"
  - trạng thái bật/tắt
- Anh làm được với từng link: tạo, sao chép, đổi quyền, đổi mật khẩu, tắt/bật, xóa. Đổi mật khẩu hoặc tắt link thì các phiên đang mở bằng link đó mất hiệu lực ngay ở lần gọi tiếp theo. Cách làm: mỗi link có số `session_version`; phiên share mang số này và phải khớp mới hợp lệ.
- Partner mở link sẽ thấy màn hình nhập mật khẩu. Nhập đúng thì được cấp cookie phiên share riêng cho token đó (hạn 7 ngày). Sau đó partner xem hoặc sửa theo quyền của link.
- Partner **không** thấy danh sách mindmap, không thấy các link share, không xóa hay đổi tên được mindmap.
- **Chống dò mật khẩu:** mỗi tổ hợp IP + đích (chủ hoặc token) sai quá 5 lần trong 15 phút thì bị khóa 15 phút. Số lần thử lưu trong bảng Postgres.

## 5. Sửa cùng nhau và lưu (em quyết, anh đã đồng ý)

- Không đồng bộ trực tiếp.
- **Tự lưu:** ngừng sửa 1,5 giây thì web tự lưu. Ctrl+S lưu ngay. Góc màn hình có trạng thái "Đang lưu… / Đã lưu / Lỗi lưu".
- **Chống ghi đè:** mỗi mindmap có số `version`. Khi lưu, web gửi kèm version đang có. Server chỉ ghi nếu version khớp (`UPDATE … WHERE id = ? AND version = ?`), rồi tăng version lên 1.
- **Khi bị lệch version:** web ngừng tự lưu và hiện thông báo "Có người vừa lưu phiên bản mới hơn". Có hai nút:
  - **Tải bản mới**: bỏ phần mình đang sửa, tải bản mới nhất.
  - **Lưu bản của tôi thành bản sao**: chỉ chủ mới có nút này. Phần anh đang sửa được lưu thành một mindmap mới tên "<tên> (bản sao)", nên không mất gì.
  - Partner chỉ có nút Tải bản mới, và trước đó có nút tải phần mình đang sửa về dạng file JSON.
- Khi tab được mở lại sau một lúc không xem (sự kiện `visibilitychange`), web lặng lẽ kiểm tra version. Nếu đã có bản mới mà mình chưa sửa gì thì tự tải bản mới.
- Quyền `view` mở được ở chế độ chỉ đọc: không kéo thả, không sửa, không tự lưu.

## 6. Trình vẽ mindmap

### 6.1 Thành phần
- **Ý (node):** chữ (một dòng hoặc nhiều dòng), màu, hình dạng, link tùy chọn sang mindmap khác, vị trí x/y.
- **Nhánh cha–con:** mỗi ý trừ ý gốc có đúng một cha. Vẽ bằng đường cong mềm từ cha sang con, cùng màu với ý con.
- **Đường nối (connection):** đường cong bezier có mũi tên, nối hai ý bất kỳ ở hai nhánh khác nhau. Kéo được điểm uốn để chỉnh độ cong. Màu mặc định xám, đổi được màu. Không có nhãn chữ (em quyết, để giữ đơn giản).
- **Ý gốc:** mỗi mindmap có một ý gốc ở giữa. Khi tạo mindmap, chữ của ý gốc lấy theo tên mindmap. Sau đó hai thứ **độc lập**: sửa chữ ý gốc không đổi tên mindmap, đổi tên mindmap không đổi chữ ý gốc. (Em quyết.) Tên mindmap là cột `title` riêng, chỉ chủ đổi được, lưu qua API riêng, không đi qua kiểm tra version của `data`.

### 6.2 Màu và hình dạng
- Bảng 10 màu có sẵn, dễ nhìn ở cả nền sáng và tối, cộng thêm ô chọn màu tự do.
- Đổi màu một ý thì hỏi có áp cho cả nhánh con không (một checkbox "áp cho nhánh con").
- Hình dạng: **chữ nhật**, **bo góc** (mặc định), **viên thuốc**, **elip**, **chỉ chữ có gạch chân**.
- Chọn được nhiều ý một lúc (Shift+click hoặc kéo khung) để đổi màu hoặc hình dạng cùng lúc.

### 6.3 Link sang mindmap khác
- Trong bảng chỉnh của một ý có mục "Link tới mindmap", chọn từ danh sách mindmap của anh.
- Ý có link hiện một icon nhỏ. Bấm icon thì mở mindmap đó.
- Partner đang dùng link share: icon vẫn hiện, nhưng bấm vào sẽ báo "Bạn chưa được chia sẻ mindmap này". Partner không xem được tên mindmap đích.
- Mindmap đích bị xóa thì link hiện "mindmap không còn tồn tại", và anh gỡ link được.

### 6.4 Bố cục (em quyết)
- **Kéo thả tự do:** mỗi ý giữ đúng vị trí anh kéo tới. Kéo một ý thì cả nhánh con đi theo.
- **Thêm ý mới** thì web tự đặt vào chỗ trống hợp lý cạnh ý cha, xếp xuống dưới các ý anh em đã có. Con của ý gốc chia đều sang trái và phải.
- **Nút "Sắp xếp gọn"** xếp lại toàn bộ mindmap thành cây cân đối hai phía, có thể hoàn tác.
- Kéo một ý thả lên ý khác thì đổi cha (chuyển nhánh). Không cho thả vào chính nhánh con của nó.

### 6.5 Thao tác
| Thao tác | Cách làm |
|---|---|
| Thêm ý con | Tab, hoặc nút + khi rê chuột vào ý |
| Thêm ý anh em | Enter |
| Sửa chữ | Double-click hoặc F2. Enter để xong, Shift+Enter để xuống dòng |
| Xóa ý (cả nhánh con) | Delete / Backspace |
| Tạo đường nối | Chọn ý, bấm nút "Nối", rồi bấm ý đích. Hoặc kéo từ chấm nối ở cạnh ý |
| Xóa đường nối | Chọn đường, Delete |
| Hoàn tác / làm lại | Ctrl+Z / Ctrl+Shift+Z (lịch sử trong phiên, 100 bước) |
| Thu gọn / mở nhánh | Bấm nút tròn ở cạnh ý có con |
| Phóng to / thu nhỏ / di chuyển | Cuộn chuột, kéo nền, nút "vừa màn hình" |

**Trạng thái riêng từng người xem (em quyết):** vị trí khung nhìn (zoom, di chuyển) và các nhánh đang thu gọn **không** lưu vào mindmap chung. Chúng lưu trong localStorage của trình duyệt từng người, theo từng mindmap. Vì vậy chỉ xem lướt, zoom hay thu gọn nhánh không tính là sửa, không tự lưu, không tăng version, không gây cảnh báo lệch version. Người có quyền `view` vẫn zoom và thu gọn nhánh được.

### 6.6 Màn hình
1. **Đăng nhập chủ** `/login`: một ô mật khẩu.
2. **Danh sách mindmap** `/`: dạng lưới thẻ, mỗi thẻ có tên và thời gian sửa gần nhất. Có ô tìm theo tên, nút "Mindmap mới", menu trên mỗi thẻ gồm Đổi tên, Nhân bản, Share, Xuất JSON, Xóa. Xóa phải xác nhận.
3. **Trình vẽ** `/m/<id>`: thanh trên gồm tên (sửa tại chỗ), trạng thái lưu, nút Sắp xếp gọn, nút Share. Bảng chỉnh nhỏ nổi cạnh ý đang chọn gồm màu, hình dạng, link mindmap. Phần còn lại là canvas.
4. **Hộp Share** (mở trong trình vẽ): danh sách link của mindmap đó, và form tạo link mới gồm nhãn, quyền, mật khẩu.
5. **Mật khẩu link share** `/s/<token>`: một ô mật khẩu, có hiện tên mindmap.
6. **Trình vẽ cho partner** `/s/<token>` sau khi nhập mật khẩu: giống trình vẽ nhưng không có nút Share, không có menu quản lý. Chế độ `view` thì chỉ đọc.

Giao diện tối giản, chữ rõ, hỗ trợ sáng/tối theo hệ thống. Mọi chữ hiển thị đều tiếng Việt.

## 7. Kỹ thuật (em quyết)

- **Framework:** Next.js (App Router) + TypeScript, chạy trên Vercel.
- **Canvas:** React Flow (`@xyflow/react`) làm nền cho node, edge, kéo thả, zoom. Node và edge tùy biến cho các hình dạng và đường nối cong.
- **Trạng thái trình vẽ:** Zustand, có lịch sử hoàn tác.
- **Style:** Tailwind CSS.
- **Database:** Supabase Postgres. Trình duyệt **không** gọi Supabase trực tiếp. Mọi truy cập đi qua API route của Next.js, dùng service role key chỉ có ở server. Bật RLS trên mọi bảng và không có policy nào cho `anon`, nên dù lộ anon key cũng không đọc được gì.
- **Mật khẩu:** `bcryptjs` (cost 10). **Phiên:** `jose`.
- **Bảng dữ liệu:**
  - `maps(id uuid pk, title text, data jsonb, version int, created_at, updated_at)`. `data` = `{ nodes: [...], edges: [...] }`, gồm cả ý, nhánh cha–con (qua `parentId` trên node) và đường nối. Không chứa khung nhìn và trạng thái thu gọn (xem 6.5).
  - `shares(id uuid pk, map_id fk → maps on delete cascade, token text unique, label text, permission text check in ('view','edit'), password_hash text, enabled bool, session_version int, created_at, last_used_at)`
  - `login_attempts(key text, attempted_at timestamptz)`, có index theo `(key, attempted_at)`. Bản ghi cũ hơn 1 ngày bị xóa bởi cron hằng ngày.
- **API:** chủ dùng các route `/api/maps*`, `/api/shares*`. Partner dùng `/api/s/<token>/*` (đọc mindmap, lưu nếu quyền là `edit`). Mọi route đều kiểm tra phiên ở server.
- **Kích thước:** giới hạn 2 MB cho `data` của mỗi mindmap, khoảng vài nghìn ý, dư cho dự án.
- **Sao lưu:** mỗi mindmap xuất được ra JSON, và nhập lại JSON thành mindmap mới.
- **Biến môi trường:** `OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- **Migration:** file SQL trong `supabase/migrations/`, chạy lên dự án Supabase của anh.

## 8. Kiểm thử

- Unit test (Vitest): băm và kiểm tra mật khẩu, ký và kiểm tra phiên, giới hạn số lần thử, kiểm tra version khi lưu, các thao tác cây (thêm, xóa, đổi cha, chặn vòng lặp), thuật toán sắp xếp gọn.
- Test API: không có phiên thì bị 401. Phiên share `view` gọi lưu thì bị 403. Token của mindmap A không đọc được mindmap B. Link đã tắt hoặc đã đổi mật khẩu thì phiên cũ hết hiệu lực.
- E2E (Playwright, chạy local): đăng nhập, tạo mindmap, thêm ý, tô màu, tạo đường nối, share, mở link ở trình duyệt khác, sửa, thấy cảnh báo lệch version.

## 9. Để lại cho người làm

- Chi tiết thuật toán đặt vị trí ý mới và "Sắp xếp gọn", miễn kết quả gọn và cân đối.
- Màu cụ thể trong bảng 10 màu, kích thước chữ, khoảng cách.
- Cấu trúc thư mục code, cách chia component.
- Thứ tự làm. Gợi ý: nền tảng và đăng nhập, rồi trình vẽ, rồi lưu và chống ghi đè, rồi share.

## 10. Các quyết định do em tự chọn (anh xem lại khi đọc)

1. Bố cục kéo thả tự do, có nút "Sắp xếp gọn".
2. Đường nối không có nhãn chữ.
3. Khi lệch version: chủ có nút lưu thành bản sao, partner có nút tải file JSON.
4. Mật khẩu chủ đặt qua biến môi trường, không có màn hình đổi mật khẩu.
5. Phiên chủ 30 ngày, phiên share 7 ngày, khóa 15 phút sau 5 lần nhập sai.
6. Không nhập từ MindMeister ở bản đầu.
7. Cron hằng ngày để Supabase Free không tự tạm dừng.
8. Trên điện thoại ưu tiên xem; sửa trên máy tính.
9. Zoom, vị trí khung nhìn và nhánh thu gọn lưu riêng từng người, không tính là sửa.
10. Tên mindmap và chữ ý gốc độc lập với nhau sau khi tạo.
