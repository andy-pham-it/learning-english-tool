# Phrase Lab Tab Improvements — Design Spec

> **Goal:** Cải tiến 3 tab trong Phrase Lab theo phản hồi người dùng: (1) tab **Phân tích** đổi từ dropdown chọn template sang **danh sách card** hiện toàn bộ nội dung; (2) tab **Điền slot** đổi từ native `<select>` sang **select card** dễ hiểu; (3) tab **Xếp thứ tự** **sửa lỗi trùng chunk** khiến người dùng không hoàn thành được chuỗi.

## 1. Tab Phân tích → Danh sách card

**Hiện tại:** `PhraseLabPageComponent` hiển thị dropdown chọn template (`<select id="template-select">`) rồi render `SentenceAnalysisComponent` cho template được chọn.

**Mới:**
- Tab Phân tích **không còn dropdown template** ở trang chính. Thay vào đó hiển thị **hàng bộ lọc** Domain / Context / Level (tái sử dụng pattern của `ChunkBrowserComponent`: 3 `<select>` với `[ngModel]` + `(ngModelChange)`, `selectDomain` reset context về 'all').
- Hiển thị **lưới card**: `<div class="grid gap-3 sm:grid-cols-2"> @for (t of filteredTemplates(); track t.id) { <app-sentence-analysis [template]="t" /> } </div>`.
- Mỗi card = `SentenceAnalysisComponent` (giữ nguyên nội dung hiện có: câu EN/VI, cấu trúc tô màu theo role qua `engine.annotateStructure`, nút 🔊 Nghe mẫu, legend màu).
- Cần `filteredTemplates` computed mới (lọc `content.templates()` theo 3 bộ lọc; 'all' → không lọc) — đặt trong `PhraseLabPageComponent` hoặc một wrapper mới.

**Quyết định:** Giữ `SentenceAnalysisComponent` không đổi (input `template`). Thay đổi nằm ở tầng trang: bỏ dropdown + thêm bộ lọc + grid. `PhraseLabPageComponent` đã có sẵn `setTab()` auto-select — cần loại `analysis` khỏi danh sách tab cần template (như `chain`/`response`/`conversation`/`explore`/`today`).

## 2. Tab Điền slot → Select card

**Hiện tại:** `SentenceBuilderComponent` render mỗi slot là native `<select>` với `[ngModel]` — người dùng không hiểu cách dùng.

**Mới (tái sử dụng pattern `RoleCombinerComponent`):**
- Thêm **dòng hướng dẫn** ở đầu tab: *"Chọn 1 lựa chọn cho mỗi chỗ trống để ghép câu hoàn chỉnh."*
- Mỗi slot render thành **fieldset card**: `@for (option of optionsFor(slot.name)) { <button (click)="set(slot.name, option.english)" class="block w-full rounded-xl border px-3 py-2 text-left text-sm transition" [class.border-slate-800]="values()[slot.name] === option.english" [class.border-slate-200]="values()[slot.name] !== option.english">{{ option.english }} <span class="text-slate-400">— {{ option.vietnamese }}</span></button> }`.
  - Slot không role: options = `slot.options` (english = chính option string, vietnamese = '').
  - Slot có role: options = chunks lọc theo role+domain+context+level (giữ nguyên logic `optionsFor` hiện có, nhưng trả về cả english + vietnamese thay vì chỉ string).
- Giữ nguyên preview câu + nút 🔊 Nghe câu.
- Có thể xóa bỏ phụ thuộc `FormsModule`/`ngModel` trong component nếu không còn `<select>`.

## 3. Tab Xếp thứ tự → Sửa lỗi trùng chunk

**Lỗi (root cause):** `OrderArrangeComponent.sequence` = `engine.expectedSequence(template, chunks)`, dùng `chunks.find()` theo role → nếu template có **2+ slot cùng role** (vd 2 slot `linker`), cả 2 trả về **cùng chunk english** → `pool()` có phần tử trùng → (a) `@for ... track item` lỗi key trùng trong Angular, (b) `@if (!picked().includes(item))` ẩn cả 2 nút sau khi chọn 1 → không thể hoàn thành chuỗi.

**Sửa:**
- Đổi `pool` thành mảng **phần tử có định danh duy nhất**: `pool = computed(() => shuffled(sequence().map((text, i) => ({ id: i + ':' + text, text }))))`.
- `picked` trở thành `signal<string[]>` lưu **các id** đã chọn.
- `tap(id)`: thêm id vào picked.
- `@for (item of pool(); track item.id) { @if (!picked().includes(item.id)) { <button (click)="tap(item.id)">{{ item.text }}</button> } }` — mỗi phần tử trùng vẫn có id riêng, chọn 1 không ẩn phần tử còn lại.
- `check()`: gọi `engine.validateOrder(template, chunks, picked().map(id => id.split(':').slice(1).join(':')))` — gửi danh sách text theo thứ tự đã chọn (khôi phục text từ id, cẩn thận text có thể chứa ':').
- `reset()`: picked = [], verdict = null (giữ nguyên pool đã shuffle hoặc shuffle lại).
- Chips đã chọn hiển thị `text` (tra từ id), màu đỏ nếu `isWrong(index)` (giữ nguyên).

**Lưu ý:** Text có thể chứa dấu `:` — cần parse id an toàn (vd `id = i + '|' + text` rồi `split('|').slice(1).join('|')`, hoặc lưu map `id → text` trong một computed để tra cứu thay vì parse chuỗi). Chọn phương án **map tra cứu** (`textOf(id)`) để tránh lỗi parse.

## 4. Testing

- **PhraseLabPageComponent.spec**: test tab analysis render grid card (nhiều `app-sentence-analysis`) + không auto-select template khi vào tab analysis; test bộ lọc lọc danh sách.
- **SentenceBuilderComponent.spec**: test render select-card buttons, click chọn cập nhật `values`, preview thay đổi.
- **OrderArrangeComponent.spec**: test template có 2 slot cùng role (fixture mới) → pool có id duy nhất, tap 1 phần tử trùng không ẩn phần tử kia, check gửi đúng thứ tự text, hoàn thành được chuỗi trùng.
- Chạy gates: `npx tsc --noEmit` EXIT 0, `npx ng test --watch=false` (toàn bộ, 134 tests hiện có), `npm run build` EXIT 0.

## Out of scope
- Không đổi các tab khác (Hôm nay, Hội thoại, Khám phá, Tổ hợp role, Luyện nói, Phản xạ, Chuỗi nói).
- Không đổi dữ liệu mẫu / Firestore.
- Không thêm tính năng mới ngoài 3 mục trên.
