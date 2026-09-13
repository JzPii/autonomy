# VF 9 Studio — Giải phẫu xe điện VinFast

Studio 3D tương tác bằng tiếng Việt cho VinFast VF 9: bệ trưng bày, mô tả 8 hệ thống, cô lập từng chi tiết
và thanh trượt "Tách rời" bung toàn bộ các mảnh lưới của xe thành một bảng kiểm kê phẳng.

Dự án giáo dục độc lập, không liên kết với VinFast. Mã nguồn kế thừa từ Model X Studio và Human Atlas
(cùng bộ khung: Three.js thuần, React 19, Vite, Tailwind 4, WebMCP).

## Chạy thử

Yêu cầu Node.js 22.13+.

```sh
npm ci
npm run dev          # http://localhost:3017
```

Kho đi kèm mô hình VF 9 thật đã xử lý (`public/models/vf9.glb`, ~12 MB, ~420 nghìn mặt, 246 chi tiết).
Để chạy lại quy trình từ mô hình gốc, xem phần dưới. `npm run model:sample` tạo một xe mẫu dựng bằng mã
nếu bạn muốn thử quy trình mà không có mô hình gốc.

## Đưa mô hình VF 9 thật vào

Mô hình đề xuất: **"Vinfast VF9 model (no interior)"** của Giang Trần trên Sketchfab, giấy phép
[CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/), khoảng 1,09 triệu mặt, chỉ có ngoại thất.
https://sketchfab.com/3d-models/vinfast-vf9-model-no-interior-cac6cb95b9084d0abee37dccb46fa10b

**Cách 1 — tải tự động** (cần token API Sketchfab, lấy tại https://sketchfab.com/settings/password):

```sh
SKETCHFAB_TOKEN=xxxxxxxx npm run model:download
```

**Cách 2 — tải thủ công**: đăng nhập Sketchfab, bấm Download → định dạng glTF, giải nén vào `source/`
(ví dụ `source/vinfast_vf9_model_no_interior/scene.gltf`). Script tự tìm tệp `.gltf`/`.glb` đầu tiên trong `source/`.
Điền `source/attribution.json` (tên, tác giả, link, giấy phép) để hiển thị ghi công trong ứng dụng.

Sau đó:

```sh
npm run model:prepare -- --simplify=0.35      # 1,09 triệu mặt → ~420 nghìn mặt, chạy ~2 giây
npm run validate
```

`model:prepare` chạy hoàn toàn bằng Node (glTF-Transform + meshoptimizer), không cần Blender:

1. Nướng transform, chuẩn hóa hệ tọa độ (dài dọc X, đầu xe về −X, bánh chạm y = 0, dài đúng 5,118 m).
   Đầu xe được đoán theo nguyên tắc "ca-pô thấp hơn cửa cốp"; nếu đoán sai, thêm `--flip`.
2. Tách từng primitive thành các đảo lưới liên thông theo vị trí đỉnh (1.171 đảo với mô hình này). Gai lốp,
   nan mâm và các chi tiết gần tâm bánh được gộp theo góc bánh; mảnh li ti gộp thành "Chi tiết nhỏ".
   Điều chỉnh bằng `--min-faces=24` và `--max-pieces=500`.
3. Phân loại mỗi mảnh vào hệ thống (thân xe / kính / cửa / nội thất / bánh xe) và gán nhãn tiếng Việt dựa trên
   tên vật liệu, độ trong suốt, phát sáng và vị trí hình học. Xem hàm `classify` trong `scripts/prepare-model.mjs`;
   Kết quả với mô hình của Giang Trần: 4 lốp, 8 mâm, 4 nắp tâm mâm, 4 cửa, cửa cốp, ca-pô, cản trước/sau, nóc,
   kính chắn gió + kính trần (một mảng liền trong mô hình gốc), kính bên, gương, đèn, tay nắm cửa, logo; khoảng
   90 mảnh ngoại thất chưa gọi tên cụ thể. Mô hình không có nội thất, chỉ có một khối tối che khoang lái.
4. Tùy chọn giảm mặt (`--simplify=0.35`), ghi `public/models/vf9.glb` và `vf9-manifest.json`.

Pin, động cơ và hệ thống treo là hình học minh họa dựng bằng mã (mô hình nguồn không có), được gắn nhãn "Minh họa".

## Triển khai

```sh
npm run build        # → dist/
```

`dist/` là trang tĩnh thuần, sao chép lên bất kỳ máy chủ web nào. Nên bật nén gzip/brotli cho `*.glb`
và `*.json`, và đặt cache dài cho `/models/*` (tên tệp có tham số `?v=` đổi theo nội dung).

## Kiểm tra

```sh
npm run check        # tsc --noEmit
npm run validate     # GLB ↔ manifest, kích thước, bố cục tách rời không chồng lấn, cử chỉ chạm
npm run lint
```

## Cấu trúc

- `app/page.tsx` — toàn bộ giao diện (bảng hệ thống, chi tiết, công cụ, thanh tách rời, giới thiệu).
- `app/vehicle-scene.tsx` — cảnh Three.js: tải GLB, nội tạng minh họa, hoạt ảnh tách rời, chọn chi tiết, nhãn.
- `app/parts.ts` — nội dung 8 hệ thống và mô tả từng loại chi tiết bằng tiếng Việt.
- `app/explosion-layout.ts`, `app/pointer-tap.ts` — bố cục kiểm kê và phân biệt chạm/xoay (dùng chung với các studio khác).
- `app/agent-tools.ts` — đăng ký công cụ WebMCP `explore_vehicle_component`.
- `scripts/` — quy trình mô hình và kiểm tra; `source/` — mô hình gốc (không đưa vào git).

## Giấy phép & ghi công

Mã nguồn: MIT. Mô hình VF 9 thuộc tác giả trên Sketchfab theo giấy phép CC BY 4.0; ghi công hiển thị trong
bảng "Về mô hình" và trong manifest. Thông số kỹ thuật tham khảo từ
https://vinfastauto.com/vn_vi/thong-so-ky-thuat-vinfast-vf9 và https://om.vinfastauto.com/.
