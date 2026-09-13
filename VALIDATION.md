# Ghi chú kiểm chứng — VF 9 Studio

Trạng thái tại lần khởi tạo kho (2026-09-13):

- **Mô hình VF 9 thật đã được đưa vào** (Giang Trần, Sketchfab, CC BY 4.0; glTF 1.090.720 mặt, 116 primitive,
  21 vật liệu, không texture). Tên vật liệu của tác giả gồm `Car_Paint.002`, `kinh_xe`, `den_xe`, `lop_xe`,
  `glass`, `light`, `MIRROR`, `logo_color` và một số `Material.NNN` không tên.
- Quy trình `model:prepare --simplify=0.35` trên mô hình thật: chuẩn hóa đúng (dài 5,118 m, cao 1,80 m, rộng
  2,43 m tính cả gương, thân 2,18 m; đầu xe đoán đúng theo ca-pô thấp), 1.171 đảo lưới → 246 chi tiết,
  420.982 mặt, GLB 11,8 MB. Tâm bánh xác định tự động tại x = ±1,56 m, z = ±0,94 m.
- Nhãn đã đối chiếu bằng tọa độ và kích thước từng mảnh (không phải bằng mắt trong Blender): lốp, mâm, nắp tâm
  mâm, cửa trước/sau, cửa cốp, ca-pô, cản, nóc, thanh nóc, kính chắn gió + kính trần, kính bên, kính sau, gương,
  đèn trước/sau, tay nắm cửa, logo, ốp bậc cửa. Khoảng 90 mảnh nhỏ của lưới `Plane.014` vẫn là "Chi tiết ngoại
  thất". Một số nhãn hình học có thể sai ở mảnh nhỏ; đã ghi `source` (tên lưới gốc) vào manifest để dò lại.
- Mô hình mẫu dựng bằng mã (`scripts/make-sample-model.mjs`) vẫn giữ để kiểm thử quy trình.
- `npm run validate` (GLB ↔ manifest, kích thước, 246 ô tách rời không chồng lấn ở 3 tỉ lệ khung hình,
  6 kiểm tra cử chỉ), `npm run check` và `npm run lint` đều đạt. `npm run build` tạo `dist/` tĩnh.
- Đã chụp màn hình bản build bằng Chrome headless (WebGL phần mềm): xe hiển thị trên bệ, giao diện tiếng Việt.
- Chưa chạy QA tương tác trong trình duyệt. Đăng ký WebMCP có kiểm tra tính năng nhưng chưa được xác nhận
  trong trình duyệt hỗ trợ.
- Thông số VF 9 (5.118 × 1.998 × 1.696 mm, cơ sở 3.150 mm, pin 123 kWh, 300 kW, 620 Nm, tầm ~580 km NEDC,
  mâm 21", treo khí nén trên bản cao cấp) lấy từ trang thông số chính thức của VinFast và các đại lý; nên đối
  chiếu lại trước khi công bố. Số chỗ, treo khí nén và cửa sổ trời khác nhau theo phiên bản.
- Pin, động cơ điện và hệ thống treo là hình minh họa, không phải bản vẽ kỹ thuật VinFast.

Việc cần làm tiếp: kiểm tra tương tác thật trên máy tính và điện thoại (tách rời, cô lập, nhãn), rà lại nhãn
của ~90 mảnh "Chi tiết ngoại thất" nếu muốn gọi tên cụ thể hơn, và cân nhắc `--simplify` thấp hơn cho di động.
