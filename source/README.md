# source/

Mô hình gốc tải về, một thư mục cho mỗi phương tiện: `source/<id>/scene.gltf` (+ `.bin`, `textures/`) hoặc `scene.glb`.
Không đưa vào git; phân phối lại theo giấy phép của từng tác giả (xem `models/<id>/model.json`).

Tải tự động từ Sketchfab (cần token): `SKETCHFAB_TOKEN=… node scripts/download-source.mjs <id> <uid>`.
