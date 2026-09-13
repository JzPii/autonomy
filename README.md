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

Kho lưu trữ đi kèm một **mô hình mẫu** dựng bằng mã (`npm run model:sample`) để giao diện chạy được ngay.
Góc trên bên trái sẽ ghi "Mô hình mẫu · chưa phải VF 9 thật" cho tới khi bạn thay bằng mô hình thật.

## Đưa mô hình VF 9 thật vào

Mô hình đề xuất: **"Vinfast VF9 model (no interior)"** của Giang Trần trên Sketchfab, giấy phép
[CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/), khoảng 1,09 triệu mặt, chỉ có ngoại thất.
https://sketchfab.com/3d-models/vinfast-vf9-model-no-interior-cac6cb95b9084d0abee37dccb46fa10b

**Cách 1 — tải tự động** (cần token API Sketchfab, lấy tại https://sketchfab.com/settings/password):

```sh
SKETCHFAB_TOKEN=xxxxxxxx npm run model:download
```

**Cách 2 — tải thủ công**: đăng nhập Sketchfab, bấm Download → định dạng glTF hoặc GLB, giải nén rồi đặt
tệp vào `source/vf9-source.glb` (hoặc `source/vf9-source.gltf` cùng `.bin` và ảnh texture).

Sau đó:

```sh
npm run model:prepare -- --simplify=0.35      # 1,09 triệu mặt → ~380 nghìn mặt
npm run validate
```

`model:prepare` chạy hoàn toàn bằng Node (glTF-Transform + meshoptimizer), không cần Blender:

1. Nướng transform, chuẩn hóa hệ tọa độ (dài dọc X, đầu xe về −X, bánh chạm y = 0, dài đúng 5,118 m).
   Đầu xe được đoán theo nguyên tắc "ca-pô thấp hơn cửa cốp"; nếu đoán sai, thêm `--flip`.
2. Tách từng primitive thành các đảo lưới liên thông theo vị trí đỉnh; gộp mảnh li ti thành "Chi tiết nhỏ".
   Điều chỉnh bằng `--min-faces=24` và `--max-pieces=500`.
3. Phân loại mỗi mảnh vào hệ thống (thân xe / kính / cửa / nội thất / bánh xe) và gán nhãn tiếng Việt dựa trên
   tên vật liệu, độ trong suốt, phát sáng và vị trí hình học. Xem hàm `classify` trong `scripts/prepare-model.mjs`;
   với mô hình cộng đồng, hãy xem kết quả trong `public/models/vf9-manifest.json` và chỉnh ngưỡng nếu cần.
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
