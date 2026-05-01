# **Product Specification: English "Think Aloud" Practice Web App**

**Version:** 1.0  
**Owner:** Technical Lead / Project Manager  
**Objective:** Xây dựng một ứng dụng web tối giản giúp các lập trình viên và quản lý kỹ thuật luyện tập các mẫu câu tiếng Anh "Think Aloud" trong các tình huống thực tế (Live coding, System Design, Team Management).

## **1\. Tổng quan hệ thống (System Overview)**

* **Kiến trúc:** Next.js (App Router), Tailwind CSS.  
* **Giao diện:** Tối giản, tập trung vào khả năng đọc. **Mặc định: Light Mode** (đảm bảo độ tương phản tốt cho mắt).  
* **Trải nghiệm:** Phản hồi nhanh, hỗ trợ phím tắt.

## **2\. Tính năng chính (Core Features)**

| Tính năng | Mô tả chi tiết   |
| :---- | :---- |
| **Phân loại danh mục (Categorization)** | Phân chia 60+ mẫu câu vào các nhóm: Setup, Logic, UI, API, Error Handling, Optimization, Business, Leadership. |
| **Thẻ ghi nhớ (Interactive Flashcards)** | Hiển thị mẫu câu tiếng Anh, kịch bản tiếng Việt tương ứng và đoạn code mẫu (nếu có). Có nút "Flip" để xem giải thích. |
| **Tích hợp Code Snippet** | Sử dụng thư viện syntax highlighting để hiển thị các đoạn code React/NextJS đi kèm với mỗi mẫu câu. |
| **Chế độ luyện nói (Voice Practice)** | Tích hợp Web Speech API để người dùng có thể nói và ứng dụng kiểm tra độ chính xác của từ khóa (keywords). |
| **Trình phát âm (Text-to-Speech)** | Nút bấm để nghe AI đọc mẫu câu với ngữ điệu chuẩn chuyên nghiệp. |

## **3\. Yêu cầu Giao diện (UI/UX Requirements)**

* **Màu sắc:** Sử dụng palette màu sáng, tránh các màu gây mỏi mắt. Font chữ sans-serif (Inter hoặc Roboto) kích thước tối thiểu 16px.  
* **Bố cục:** Sidebar bên trái để chọn danh mục, khu vực chính giữa hiển thị thẻ luyện tập.  
* **Khả năng đáp ứng (Responsive):** Hoạt động tốt trên cả Desktop và Mobile để có thể luyện tập mọi lúc.

## **4\. Cấu trúc dữ liệu (Data Structure Sample)**

`[`  
  `{`  
    `"id": 1,`  
    `"category": "Setup",`  
    `"english": "Let's start by defining the interface for our component's props to ensure type safety.",`  
    `"vietnamese": "Hãy bắt đầu bằng việc định nghĩa interface cho props của component để đảm bảo an toàn về kiểu dữ liệu.",`  
    `"code": "interface UserCardProps { id: string; username: string; }",`  
    `"context": "Khởi tạo component mới trong TypeScript."`  
  `}`  
`]`

## **5\. Lộ trình phát triển (Roadmap)**

1. **Phase 1:** MVP \- Hiển thị danh sách và lọc theo danh mục.  
2. **Phase 2:** Thêm tính năng Flashcard và Text-to-Speech.  
3. **Phase 3:** Tích hợp Speech-to-Text để đánh giá phát âm.

*Tài liệu này được soạn thảo để cung cấp cho AI Agent nhằm mục đích tự động hóa việc khởi tạo source code và cấu trúc thư mục dự án.*