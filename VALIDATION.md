# Ghi chú kiểm chứng — Autonomy (2026-09-13)

- Ba phương tiện chạy qua cùng một pipeline và ứng dụng:
  - VinFast VF 9 (Giang Trần): 1,09 M mặt → 423 K mặt, 279 chi tiết, 11,9 MB. Không nội thất (khối che).
  - Porsche 911 Turbo 930 (Lionsharp): 241 K mặt, 197 K sau khi bỏ lớp clear-coat trùng lặp, 225 chi tiết, 7,5 MB,
    26 texture WebP 1024. Vỏ sơn là một mảng liền nên cửa/ca-pô không tách. Đã bỏ mặt bóng nền (object_74) và
    gán ăng-ten (object_25). Nội thất đơn giản có sẵn.
  - Porsche 911 Turbo S 992 (n.brizitskaya): 424 K mặt → 411 K, 450 chi tiết (giới hạn), 16,1 MB, 42 texture WebP.
    Nội thất đầy đủ; cửa trái ở tư thế mở trong mô hình gốc — pipeline dịch ngang 0,34 m để tâm bánh đối xứng.
- Chiều cao/bề ngang thân dùng số khai báo trong model.json thay cho đo bbox (ăng-ten, gương, cửa mở làm sai).
- `npm run validate` đạt cho cả ba (GLB ↔ manifest, kích thước, bố cục không chồng lấn ở 3 tỉ lệ, cử chỉ).
  `npm run check` và `npm run lint` đạt.
- `scripts/qa-shot.mjs` (Chrome headless + DevTools): cả ba trang tải xong không có lỗi console; VF 9 8 s,
  930 10 s, 992 15 s trên WebGL phần mềm. Gallery, switcher, tìm kiếm chưa được kiểm tra tương tác bằng tay.
- Nén EXT_meshopt_compression giảm dung lượng ~55–65 %; bản nhẹ (≈150–240 K mặt, texture 512) cho điện thoại. Cả hai bản
  đi qua validate (Node GLTFLoader + MeshoptDecoder). Điện thoại giả lập (390×844, DPR 2, cảm ứng) đã chụp gallery, studio,
  chi tiết, bảng hệ thống, bảng giới thiệu, tách rời 60 %: bố cục hợp lệ, bản nhẹ được chọn tự động.
- Người dùng báo Safari iOS bị sập ở 100 % tách rời với 2× DPR → độ nét theo mức tách rời (2× ≤10 %, sau đó 1,5×/1,25×);
  chưa xác nhận lại trên máy thật.
- Chưa kiểm tra bằng tay trên điện thoại thật. Nhãn hình học ở mảnh nhỏ có thể sai; xem `public/models/<id>/review.md`.
- Thông số kỹ thuật lấy từ nguồn công khai (trang hãng, Wikipedia); nên đối chiếu trước khi công bố.

## Kiểm toán nhãn (2026-09-13)

Ba tác nhân độc lập (một xe/tác nhân) đối chiếu review.md + manifest + scene.gltf. Phát hiện hai lỗi pipeline: cụm bánh
bị vứt khi vượt giới hạn mảnh (mất vô-lăng và một góc mâm của 992), và nhóm "chi tiết nhỏ" không được phân tích tên.
Khoảng trống bộ phân loại: xe động cơ sau bị gán "cửa cốp"; cánh gió/nắp khoang máy; gương và tay nắm nhầm; vùng đèn;
nội thất bị kéo bởi hậu tố "_int" của vật liệu ngoại thất. Đã sửa: bộ phân loại nhận `layout` (ev/rear-engine) và
`doors`; nhóm gộp đi qua luật tên; vùng đèn và nội thất cơ bản (ghế, vô-lăng, táp-lô, bệ trung tâm) theo hình học;
hints riêng cho từng xe (VF 9: 17, 930: 17, 992: 16); thêm khóa sensor, camera, speaker, engine.lid.

Kết quả: VF 9 "chi tiết ngoại thất" 111 → 52 và không còn mảnh nào bị vứt; 930 không còn mảnh chung; 992 "chi tiết nhỏ"
168 → 10, có vô-lăng, ghế, táp-lô, bệ trung tâm, loa, dây an toàn, thảm, màn hình, ống xả. Còn ~50 mảnh VF 9 từ lưới
thân xe liền khối không gọi tên được bằng regex; các luật hình học chung có thể còn gán sai ở mảnh nhỏ.
