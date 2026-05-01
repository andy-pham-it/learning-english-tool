# Hướng dẫn Deploy lên Vercel

Vì dự án của bạn đã có cấu hình Vercel (`.vercel`), việc deploy sẽ rất đơn giản. Dưới đây là các bước chi tiết để đảm bảo ứng dụng PWA và các tính năng AI hoạt động chính xác.

## 1. Cấu hình trên Dashboard Vercel

Khi tạo mới project trên Vercel, hãy thiết lập các thông số sau:

- **Framework Preset**: `Angular`
- **Root Directory**: `web`
- **Build Command**: `npm run build`
- **Output Directory**: `dist/web/browser` (Quan trọng: Phải trỏ vào thư mục `browser` bên trong)

## 2. Thiết lập Biến môi trường (Environment Variables)

Dự án sử dụng Gemini API, bạn cần thêm biến sau vào phần **Settings > Environment Variables** trên Vercel:

| Key | Value |
| :--- | :--- |
| `GEMINI_API_KEY` | `AIzaSy...OtJw` (Lấy từ file `.env` của bạn) |

> [!IMPORTANT]
> Đảm bảo bạn đã thêm biến này cho cả môi trường **Production**, **Preview**, và **Development** trên Vercel.

## 3. Các bước Deploy thực tế

### Cách 1: Sử dụng Vercel CLI (Khuyên dùng)
Nếu bạn đã cài đặt Vercel CLI trên máy:

```bash
cd web
vercel --prod
```

### Cách 2: Deploy qua GitHub/GitLab
Nếu bạn đã đẩy code lên các nền tảng Git, Vercel sẽ tự động deploy mỗi khi bạn push code.

## 4. Kiểm tra sau khi Deploy

Sau khi Vercel báo **Deployment Complete**, hãy kiểm tra các mục sau:

1.  **PWA**: Mở trang web, kiểm tra xem có biểu tượng "Cài đặt ứng dụng" (Install App) xuất hiện trên thanh địa chỉ không.
2.  **Firebase**: Thử đăng nhập và thực hiện một vài hành động (như học Flashcard) để đảm bảo Firestore Lite hoạt động ổn định.
3.  **AI Features**: Thử tính năng Boss Fight (nếu có dùng Gemini) để kiểm tra biến `GEMINI_API_KEY` đã được nhận đúng chưa.

## 5. Lưu ý sau tối ưu hóa
Do chúng ta đã tối ưu bundle xuống còn ~500kB, ứng dụng sẽ vượt qua bài kiểm tra Core Web Vitals của Google (Lighthouse) một cách dễ dàng, giúp SEO và trải nghiệm PWA tốt hơn.
