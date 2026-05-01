# **HỆ SINH THÁI CÔNG CỤ & TRÒ CHƠI RÈN LUYỆN (GAMIFICATION)**

**Dự án:** ProEnglish

**Tiêu chí thiết kế:** Microlearning (Mỗi session \< 5 phút), Zero-Cost (Xử lý 100% tại Client-side), B2 Focus (Tập trung phản xạ cụm từ, không học từ đơn).

## **1\. NHÓM CÔNG CỤ HỌC TẬP CỐT LÕI (LEARNING TOOLS)**

Đây là các công cụ nền tảng để người dùng "nạp" kiến thức mới mỗi ngày.

### **1.1. Smart Flashcards (Thẻ nhớ thông minh \- SRS)**

* **Cách hoạt động:** Thẻ 2 mặt. Mặt trước hiển thị một cụm từ (Chunk) và audio. Mặt sau giải nghĩa và đưa ra câu ví dụ theo đúng ngành nghề (IT, Marketing, Đời sống).  
* **Điểm nhấn B2:** Luôn luôn là cụm từ (VD: *"Reach out to"*, *"Take into consideration"*).  
* **Công nghệ (Zero-cost):** Thuật toán Spaced Repetition (SuperMemo-2) chạy trên LocalStorage. Audio dùng Web Speech API (miễn phí).

### **1.2. Màn "Boss Fight" (AI Role-play Chat)**

* **Cách hoạt động:** Giao diện nhắn tin giả lập (Zalo/Slack). Người dùng chat với AI để giải quyết tình huống.  
* **Ví dụ:** AI báo: *"The production database is down."* \-\> Người dùng phải gõ phản hồi.  
* **Công nghệ:** API Gemini 1.5 Flash (Gói Free Tier).

## **2\. NHÓM MINIGAME RÈN LUYỆN 4 KỸ NĂNG (DAILY DRILLS)**

Hệ thống bài tập cực ngắn (2-3 phút) xuất hiện ngẫu nhiên mỗi ngày để người dùng không bị nhàm chán, phủ đều 4 kỹ năng: Nghe, Nói, Đọc, Viết.

### **2.1. Kỹ năng Nghe (Listening)**

* **Trò chơi 1: The Eavesdropper (Nghe lén công sở)**  
  * **Mục tiêu:** Luyện nghe tốc độ tự nhiên và bắt từ khóa (Keywords).  
  * **Cách hoạt động:** App phát một đoạn hội thoại 10 giây (Tốc độ 1.2x) mô phỏng một cuộc họp. Màn hình hiện câu hỏi trắc nghiệm nhanh: *"What is the main blocker mentioned?"* (Rào cản chính được nhắc đến là gì?).  
  * **Công nghệ:** Web Speech API TTS chỉnh rate (tốc độ đọc) lên cao để giả lập giọng bản xứ nói nhanh.  
* **Trò chơi 2: Chunk Dictation (Nghe chép chính tả vi mô)**  
  * **Mục tiêu:** Nhớ chính xác âm thanh của giới từ, mạo từ trong cụm B2 (thứ người Việt hay sai nhất).  
  * **Cách hoạt động:** App đọc một câu ví dụ. Trên màn hình có một ô trống ngay vị trí của cụm từ vựng mục tiêu. User phải gõ lại chính xác cụm từ đó.  
  * **Tương tác:** Nghe và gõ phím. Cấu hình kiểm tra chuỗi (String Matching) trên thiết bị.

### **2.2. Kỹ năng Nói (Speaking)**

* **Trò chơi 3: Shadowing Master (Nhại giọng chuyên nghiệp)**  
  * **Mục tiêu:** Luyện phát âm (Pronunciation) và ngữ điệu (Intonation).  
  * **Cách hoạt động:** App phát audio một câu mẫu B2. Người dùng bấm giữ nút "Record" và đọc lại y hệt câu đó.  
  * **Công nghệ:** Web Speech Recognition API (Miễn phí 100%, tự chuyển giọng nói thành text). So sánh text nhận diện được với câu gốc để chấm điểm (Perfect, Good, Try Again).  
* **Trò chơi 4: Elevator Pitch (Thuyết trình thang máy 30s)**  
  * **Mục tiêu:** Luyện phản xạ nói tự nhiên, ép sử dụng từ vựng B2.  
  * **Cách hoạt động:** Màn hình cho 1 chủ đề (VD: *Explain why we should delay the release*) và cung cấp 3 cụm từ vựng B2 bắt buộc phải dùng. Người dùng có 30 giây để thu âm câu trả lời.  
  * **Công nghệ:** Dùng Speech-to-Text để lấy transcript. Kiểm tra xem người dùng có đọc trúng 3 "cụm keyword" kia không (Xử lý Regex ở Client). Nếu đủ \-\> Pass.

### **2.3. Kỹ năng Đọc (Reading)**

* **Trò chơi 5: Tinder Swipe (Quẹt thẻ ngữ cảnh)**  
  * **Mục tiêu:** Đọc nhanh, phân biệt sắc thái lịch sự/thô lỗ (Tone) \- Rất quan trọng ở mức B2.  
  * **Cách hoạt động:** Hiển thị 1 tình huống (VD: *"Phản đối ý kiến của sếp"*). Thẻ bài hiện câu tiếng Anh. Quẹt phải nếu câu đó là B2 lịch sự, Quẹt trái nếu câu đó phèn/bất lịch sự.  
  * **Công nghệ:** Thư viện UI (Framer Motion / React Spring).  
* **Trò chơi 6: Logic Jigsaw (Xếp hình báo cáo)**  
  * **Mục tiêu:** Hiểu cấu trúc lập luận (Discourse/Cohesion), các từ nối B2.  
  * **Cách hoạt động:** Một email báo cáo hoặc giải trình bị xáo trộn thành 4 đoạn nhỏ. Người dùng phải kéo thả (Drag & Drop) để xếp lại thành một email hoàn chỉnh, mạch lạc dựa trên các từ nối như *"Consequently"*, *"Regarding to"*, *"As a result"*.

### **2.4. Kỹ năng Viết (Writing)**

* **Trò chơi 7: The Email Debugger (Siêu thợ sửa lỗi)**  
  * **Mục tiêu:** Nâng cấp văn phong từ A2 lên B2.  
  * **Cách hoạt động:** Cung cấp đoạn text phèn (VD: *"I think this code is bad"*). Chạm vào từ bị bôi đỏ và chọn cụm B2 thay thế từ Menu thả xuống (VD đổi thành *"This code is not optimal"*).  
* **Trò chơi 8: Chunk Builder (Gép từ vựng)**  
  * **Mục tiêu:** Viết chuẩn cấu trúc (Collocations).  
  * **Cách hoạt động:** Có một câu bị đục lỗ và các khối từ lộn xộn bên dưới: \[come\] \[out\] \[up\] \[with\] \[to\]. Kéo thả các khối vào chỗ trống để tạo thành cụm *"come up with"*.  
* **Trò chơi 9: The Diplomat (Nhà Ngoại Giao)**  
  * **Mục tiêu:** Luyện viết câu dài, uyển chuyển (Sentence Expansion).  
  * **Cách hoạt động:** Cho một câu thô cứng: *"We can't finish this by tomorrow."*. Yêu cầu người dùng gõ thêm các tiền tố/hậu tố để câu mềm mỏng hơn.  
  * **Ví dụ User gõ:** *"**I am afraid that** we can't finish this by tomorrow, **due to some unforeseen issues**"*. (Hệ thống kiểm tra sự xuất hiện của các cụm từ làm mềm câu \- hedging/softening phrases).

## **3\. HỆ THỐNG TẠO ĐỘNG LỰC (MOTIVATION ENGINE)**

* **Streak (Chuỗi ngày học):** Cơ chế "ngọn lửa" kinh điển. Giữ chuỗi bằng cách hoàn thành tối thiểu 1 Minigame (khoảng 3 phút) mỗi ngày.  
* **Hệ thống cấp bậc Công ty (Corporate Ladder):** \* Bắt đầu với rank **"Intern"** (Thực tập sinh).  
  * Tích lũy điểm (XP) từ các minigame để thăng cấp lên **"Junior"**, **"Senior"**, **"Manager"** và **"C-Level"**. Mỗi rank sẽ mở khóa giao diện thẻ bài (Flashcard) có màu sắc "xịn xò" hơn.  
* **Huy hiệu Kỹ năng (Skill Badges):** \* Chơi nhiều game "The Eavesdropper" \-\> Nhận huy hiệu **"Active Listener"**.  
  * Qua nhiều màn "The Diplomat" \-\> Nhận huy hiệu **"Master of Tact"** (Bậc thầy khéo léo).