# System Design & Architecture: ProEnglish

Bản thiết kế kiến trúc hệ thống áp dụng chiến lược **Zero-Cost**, **Microlearning**, và tối ưu hóa tải lượng server.

## 1. Kiến trúc tổng thể (Architecture Overview)

Dự án hoạt động theo cấu trúc **Client-Side Rendering (CSR) / SPA**, hạn chế tối đa Backend Server truyền thống. Ứng dụng tuân theo triết lý **Mobile-first**, tập trung vào trải nghiệm di động trước.

*   **Frontend Framework:** **Angular** (Phiên bản mới nhất, Standalone Components, Signals).
*   **Hosting & Serverless Layer:** **Vercel**
    *   Hosting toàn bộ Static/Frontend Assets (Miễn phí).
    *   Sử dụng *Vercel Serverless Functions* để proxy bảo mật gọi API AI bên thứ ba.
*   **BaaS (Backend as a Service):** **Firebase (Spark Plan - Free)**
    *   **Firebase Authentication:** Quản lý đăng nhập bắt buộc (Google, Email/Password). Người dùng phải đăng nhập để sử dụng.
    *   **Cloud Firestore:** Lưu trữ dữ liệu hệ thống người dùng (Profile, Streak, XP, Rank). Tối giản thao tác Read/Write do dùng bản miễn phí.
*   **Local Storage & Caching Layer:**
    *   Sử dụng **IndexedDB** lưu trữ toàn bộ hệ thống Flashcards, tham số SuperMemo-2 tại local Client.
*   **AI & Browser Native APIs (Zero-Cost):**
    *   **Google Gemini 1.5 Flash:** Xử lý chat "Boss Fight".
    *   **Web Speech API & Speech Recognition:** Đọc Text-to-Speech và xử lý Speech-to-Text miễn phí.

## 2. Giải pháp tài nguyên tĩnh đa lĩnh vực (Data Generation Pipeline)

Để đảm bảo nguồn tài nguyên phong phú (từ vựng B2 ở mọi loại ngành nghề: IT, Marketing, Y tế, Kỹ thuật...) mà không tốn công sức làm thủ công, hệ thống sử dụng kiến trúc Data tĩnh dạng Module:

1.  **AI Data Generator (Công cụ CLI nội bộ):** Sử dụng 1 đoạn script bằng Node.js / Python vận hành độc lập bởi Developer/Admin. Tool sẽ kết nối API LLM (Gemini) với prompt chuẩn để tự động kết xuất ra một lượng lớn từ vựng/ví dụ theo format JSON cấu trúc chặt chẽ.
2.  **Đóng gói dữ liệu vĩnh viễn (Asset Bundler):** Các file `.json` sinh ra được phân loại theo từng nhóm ngành học và bundle thẳng vào file Build của Angular tại phía Frontend (ví dụ `/assets/data/it_b2.json`).
3.  **Client Fetch:** Khi user học và chọn một chủ đề học nhất định trên App, ứng dụng sẽ fetch file JSON trực tiếp trên môi trường tĩnh của Vercel hoàn toàn miễn phí mà không hề tốn lượt "Read" nào trên Database Firestore.

## 3. Lộ trình nâng cấp bản Desktop App

Codebase này hoàn toàn có thể "nâng cấp" cho hệ điều hành Desktop (Mac/Windows) trong tương lai với tài nguyên tối thiểu, bằng 2 giải pháp song song:

*   **Giải pháp 1 - PWA (Progressive Web App):** 
    Đây là cách nhanh nhất và "Zero-cost". Bằng việc cài đặt *Angular PWA / Service Worker*, user có thể install thẳng Web app thành Desktop application với icon riêng biệt, chạy offline (cache) và push notification mà không cần code lại.
*   **Giải pháp 2 - Tauri:** 
    Một framework bọc Desktop bằng Rust (thay thế Electron). Khác với Electron rất nặng, Tauri dùng WebView OS nên bộ cài cực nhỏ (dưới 5MB). Quá trình đưa code web Angular vào Tauri rất dễ dàng. Điều này đảm bảo khi ta muốn có một bản "Premium Native Desktop" sau này, ta chỉ cần tái sử dụng 100% codebase và setup thêm Tauri hook, mà vẫn có thể phân phối trên Desktop Stores.

## 4. Các Giai đoạn triển khai (Phases)

*   **Phase 1 - Foundation:** Thiết lập Angular, Vercel CI/CD, chuẩn CSS Tailwind, nhúng Firebase Auth bắt buộc, layout Header/Nav bar theo hướng Mobile-first.
*   **Phase 2 - Data & Core Learning:** Xây dựng script Data Generation. Viết logic bài tập Flashcards, Storage offline (IndexedDB), UI lật flashcards bằng Tailwind & Vanilla CSS animations.
*   **Phase 3 - Daily Drills (Minigame):** Làm Game 1 (Nghe rớt từ) và Game 3 (Nói dùng Web Speech API chấm điểm).
*   **Phase 4 - Boss Fight:** Đấu nối Gemini Serverless, thiết kế không gian Roleplay Chat công sở.
