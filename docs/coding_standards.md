# Tiêu chuẩn lập trình & Triển khai (Coding Standards & Guidelines)

Dưới đây là các tiêu chuẩn bắt buộc (Guidelines) khi implement dự án **ProEnglish**.

## 1. Ngôn ngữ & Framework
*   **Framework:** **Angular mới nhất**. Tất cả cấu trúc sử dụng **Standalone Components**, tuyệt đối không sử dụng `NgModules`.
*   **Strict Mode:** Bật flag `strict: true` cho TypeScript. Sử dụng interface/type chuẩn hóa. Tránh `any`.
*   **State Management:** Khoan sử dụng Signals. Ứng dụng sẽ sử dụng **Zone.js** mặc định của Angular cùng với kiến trúc dựa trên **RxJS (BehaviorSubject, Observable)** để quản lý trạng thái. Cấu trúc component và Data Flow phải được thiết kế rành mạch, ít ràng buộc chéo (loose coupling) để trong tương lai có thể dễ dàng upgrade/migrate sang Signals nếu cần thiết.
*   **Authentication (Bắt buộc):** Truy cập vào ứng dụng yêu cầu bắt buộc đăng nhập (RouteGuard chặn mọi trang trừ màn hình Login/Landing). Guest Mode không được hỗ trợ.

## 2. Tiêu chuẩn Giao diện (UI/UX)
*   **TailwindCSS là Cốt lõi (Core Styling):** Ưu tiên **sử dụng TailwindCSS** để layout tổng thể (Margin, Padding, Grid, Flex, Color, Typography). Việc này giúp source HTML nhất quán và triển khai nhanh chóng.
*   **Vanilla CSS ở cấp độ Vi mô (Micro-animations):** Chỉ dùng CSS thuần (`.component.css`) cho việc xử lý các animation phức tạp, keyframes 3D đặc thù (VD: hiệu ứng lật thẻ thẻ 3D, hiệu ứng vuốt Tinder, glow gradient động). Không cố lạm dụng class Tailwind nếu animation quá chồng chéo và khó maintain.
*   **Mobile-First (Ưu tiên di động):** Xây dựng mọi layout mặc định cho Mobile. Chỉ thiết lập Responsive trên Tablet/Desktop dựa vào breakpoint của Tailwind (VD: `w-full md:w-1/2`).
*   **Trải nghiệm cao cấp (Premium Aesthetics):**
    *   Tránh các màu sắc nguyên bản (VD: thuần Blue, thuần Red...). Dùng các phối màu HSL nhẹ nhàng tinh tế kết hợp Dark Mode chuẩn chỉnh.
    *   Trọng tâm là hiệu ứng thị giác: Tận dụng glassmorphism (`backdrop-blur-md`), bóng đổ dập nổi, bo góc mượt mà (`rounded-2xl`).

## 3. Cấu trúc thư mục (Folder Architecture)
Kiến trúc mã nguồn áp dụng "Feature-based":
*   `/src/app/core/`: Các Singleton logic chạy xuyên suốt (Firebase Config, Services, Interceptors, Guards).
*   `/src/app/shared/`: Các UI Components dùng lại nhiều bằng Tailwind: Buttons, Modals, Forms, Icons.
*   `/src/app/features/`: Chứa các Business logic chuyên biệt (Được lazy load):
    *   `/auth`, `/dashboard`, `/flashcards`, `/minigames`, `/bossfight`.

## 4. Tương tác APIs & Hiệu suất (Zero-Cost Optimization)
*   **Bảo mật:** Mọi API gọi tới AI phải thông qua thư mục `/api` được xử lý của Vercel Serverless Function, tuyệt đối không lộ API Key ở Frontend.
*   **Offline First / Batch Processing:** Xử lý tối đa logic lưu dữ liệu trên Front-end, chỉ push Batch data kết quả lên Database.
