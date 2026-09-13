# Ghi chú kiểm chứng — VF 9 Studio

Trạng thái tại lần khởi tạo kho (2026-09-13):

- **Chưa có mô hình VF 9 thật trong kho.** Sketchfab yêu cầu đăng nhập để tải, và máy dựng không có token.
  Kho đi kèm mô hình mẫu dựng bằng mã (`scripts/make-sample-model.mjs`) để kiểm thử quy trình và giao diện.
- Quy trình `model:prepare` đã được kiểm thử trên mô hình mẫu: chuẩn hóa từ đơn vị cm, trục dài Z, đầu xe +Z,
  node xoay 90° và dịch chuyển → ra đúng 5,118 m dọc X, đầu xe về −X, bánh chạm y = 0. Tách 7 primitive thành
  40 mảnh; 4 lốp, 4 mâm, 4 đĩa phanh, 4 cửa, cửa cốp, ca-pô, hai cản, kính chắn gió/kính sau/kính bên, đèn
  được nhận diện đúng. Tai xe ở sample bị gán thành cửa trong lần đầu và đã chỉnh ngưỡng; các ngưỡng này
  **chưa được xác nhận trên lưới thật** của mô hình cộng đồng.
- `npm run validate` (GLB ↔ manifest, kích thước, 40 ô tách rời không chồng lấn ở 3 tỉ lệ khung hình,
  6 kiểm tra cử chỉ) và `npm run check` đều đạt. `npm run build` tạo `dist/` tĩnh.
- Chưa chạy QA tương tác trong trình duyệt. Đăng ký WebMCP có kiểm tra tính năng nhưng chưa được xác nhận
  trong trình duyệt hỗ trợ.
- Thông số VF 9 (5.118 × 1.998 × 1.696 mm, cơ sở 3.150 mm, pin 123 kWh, 300 kW, 620 Nm, tầm ~580 km NEDC,
  mâm 21", treo khí nén trên bản cao cấp) lấy từ trang thông số chính thức của VinFast và các đại lý; nên đối
  chiếu lại trước khi công bố. Số chỗ, treo khí nén và cửa sổ trời khác nhau theo phiên bản.
- Pin, động cơ điện và hệ thống treo là hình minh họa, không phải bản vẽ kỹ thuật VinFast.

Việc cần làm khi có mô hình thật: chạy `model:prepare --simplify=0.35`, đọc manifest, chỉnh `classify` cho
tên vật liệu của tác giả, kiểm tra hướng đầu xe (`--flip` nếu cần), rồi kiểm tra trên điện thoại thật.
