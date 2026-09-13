# Autonomy — Giải phẫu phương tiện · Vehicle anatomy

Studio 3D tương tác, song ngữ Việt–Anh: chọn một phương tiện, xoay, kéo thanh "Tách rời" để bung toàn bộ chi tiết
thành bảng kiểm kê, tìm chi tiết theo tên, đọc mô tả từng hệ thống. Trang tĩnh thuần, không backend.

Interactive bilingual exploded-view studio. Pick a vehicle, orbit it, drag the slider to separate every piece into
an inventory grid, search parts by name, read how each system works. Pure static site, no backend.

Hiện có / currently: VinFast VF 9 · Porsche 911 Turbo (930, 1975) · Porsche 911 Turbo S (992).

## Chạy / Run

```sh
npm ci
npm run dev          # http://localhost:3017  (registry + trang cho từng xe được sinh tự động)
npm run build        # → dist/  (trang tĩnh: /, /<id>/, /models/<id>/…)
```

Xem `dist/` mà không cần npm: `python3 -m http.server 8080 -d dist`. Bản demo: https://jzpii.github.io/autonomy/ (GitHub Pages, tự triển khai từ `main`).

## Cấu trúc / Layout

```
models/<id>/            nguồn sự thật cho mỗi phương tiện (viết tay)
  model.json            id, hãng, tên, loại, kích thước, ghi công, cấu hình pipeline, liên kết
  content.vi.json       hệ thống (tên, mô tả, nguyên lý, thông số, vị trí nhãn, offset tách rời), nhãn/ghi chú riêng
  content.en.json       bản tiếng Anh, cùng cấu trúc
  internals.json        nội tạng minh họa (hộp/trụ/ống) cho các hệ thống mô hình nguồn không có
source/<id>/            mô hình gốc tải về (git-ignore)
public/models/<id>/     sinh ra: model.glb (đầy đủ) + model.light.glb (bản nhẹ), manifest.json, review.md (+ bản sao model/content/internals)
public/registry.json    sinh ra: danh sách phương tiện cho trang chủ và bộ chuyển đổi
app/                    ứng dụng React + Three.js dùng chung cho mọi xe
  app.tsx               định tuyến: / → gallery, /<id>/ → studio
  page.tsx              studio: hệ thống, chi tiết, tách rời, cô lập, tìm kiếm, ngôn ngữ, liên kết sâu
  vehicle-scene.tsx     cảnh Three.js chạy theo dữ liệu (kích thước, hệ thống, nội tạng)
  search.tsx            "Tìm chi tiết": gõ tên chi tiết/hệ thống bằng tiếng Việt hoặc Anh (phím /)
  switcher.tsx          bảng tên góc trên trái → danh sách phương tiện
  i18n/ui.ts            chuỗi giao diện vi/en · i18n/labels.ts: nhãn chi tiết và mô tả theo khóa
  agent-tools.ts        WebMCP: explore_vehicle_component, find_structure, inspect_structure
scripts/
  prepare-model.mjs     quy trình mô hình (Node, không cần Blender)
  build-registry.mjs    gom models/*/ → registry + web/<id>/index.html
  validate-*.mjs        kiểm tra GLB↔manifest, bố cục tách rời, cử chỉ chạm
  qa-shot.mjs           chụp màn hình + bắt lỗi console bằng Chrome headless
```

## Thêm một phương tiện / Add a vehicle

1. Tải mô hình glTF/GLB vào `source/<id>/` (Sketchfab: `SKETCHFAB_TOKEN=… node scripts/download-source.mjs <id> <uid>`).
2. Tạo `models/<id>/model.json` (kích thước thật dài/rộng/cao/cơ sở/vệt bánh, ghi công, `pipeline`).
3. `npm run model:prepare -- <id>`; đọc `public/models/<id>/review.md`, sửa nhãn sai bằng `pipeline.hints`
   (`match` là regex trên "vật liệu tên-lưới tên-node", `part` + `key` theo `app/i18n/labels.ts`); mảnh cần bỏ → `pipeline.ignore`.
4. Viết `content.vi.json`, `content.en.json` (và `internals.json` nếu cần), rồi `npm run validate -- <id>`.
5. `npm run dev` — trang `/<id>/` và mục trong gallery/switcher xuất hiện tự động.

Pipeline: bake transform → chuẩn hóa trục (dài dọc X, đầu xe −X, bánh chạm y = 0, dài đúng khai báo; đầu xe đoán theo
"ca-pô thấp hơn đuôi", ghi đè `pipeline.flip`) → tách đảo lưới liên thông → gộp gai lốp/nan mâm theo góc bánh, dịch ngang
để tâm bánh đối xứng (cửa mở/gương không làm lệch xe) → phân loại (từ khóa vật liệu/tên lưới, độ trong suốt, phát sáng,
vị trí so với kích thước khai báo) → giảm mặt (`pipeline.simplify`) → nén texture WebP ≤ `pipeline.textures` px →
bản nhẹ cùng tập chi tiết (`pipeline.light`: mặc định ≈150 nghìn mặt, texture 512 px) → nén hình học EXT_meshopt_compression.

Ứng dụng tự chọn bản nhẹ trên điện thoại hoặc mạng chậm/tiết kiệm dữ liệu; ghi đè bằng `?q=full` / `?q=light` hoặc
trong bảng "Về mô hình". Độ nét render: tới 2× DPR khi xe nguyên khối (tách rời = 0), 1,5× desktop / 1,25× cảm ứng ngay khi bắt đầu bung chi tiết.

| Xe | Đầy đủ | Bản nhẹ |
|---|---|---|
| VinFast VF 9 | 4,2 MB · 423 K mặt | 2,9 MB · 241 K mặt |
| Porsche 911 Turbo (930) | 3,7 MB · 197 K mặt | 2,4 MB · 151 K mặt |
| Porsche 911 Turbo S (992) | 7,7 MB · 420 K mặt | 4,0 MB · 166 K mặt |

## Kiểm tra / Checks

```sh
npm run check                          # tsc
npm run lint
npm run validate [-- <id>]             # GLB ↔ manifest, kích thước, bố cục không chồng lấn, cử chỉ
npm run qa -- http://localhost:4173/porsche-911-930/ /tmp/shot.png [--mobile] [--click=.switcher-button]   # sau `npm run preview`
```

## Giấy phép & ghi công / License & credits

Mã nguồn MIT. Mô hình 3D thuộc tác giả trên Sketchfab theo CC BY 4.0, ghi công hiển thị trong bảng "Về mô hình"
của từng xe và trong `models/<id>/model.json`: Giang Trần (VF 9), Lionsharp Studios (911 930), n.brizitskaya (911 992).
Tên và logo hãng thuộc chủ sở hữu tương ứng; dự án giáo dục độc lập, không liên kết với hãng xe nào.
