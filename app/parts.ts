export type PartId = 'body'|'glass'|'doors'|'cabin'|'battery'|'drive'|'suspension'|'wheels';
export type Part = {id:PartId;name:string;category:string;tag:string;description:string;principle:string;specs:[string,string][];source:string};
/** Nhóm hệ thống có hình học minh họa dựng bằng mã, không lấy từ mô hình nguồn. */
export const illustrative:PartId[]=['battery','drive','suspension'];
export const specsPage='https://vinfastauto.com/vn_vi/thong-so-ky-thuat-vinfast-vf9';
export const manual='https://om.vinfastauto.com/';
export const vehicle={brand:'VINFAST',model:'VF 9',lengthMeters:5.118,widthMeters:1.998,heightMeters:1.696};
export const parts:Part[] = [
{id:'body',name:'Thân xe & kết cấu',category:'Ngoại thất',tag:'LỚP VỎ BẢO VỆ',description:'Thân xe gắn kết mọi thứ lại với nhau: khoang hành khách kín, vùng hấp thụ lực va chạm ở hai đầu và bề mặt ngoại thất liền mạch dẫn luồng không khí bao quanh xe.',principle:'Kết cấu chịu lực dẫn tải trọng vòng quanh khoang lái. VF 9 dài hơn 5,1 m, thuộc phân khúc SUV cỡ E, với nắp ca-pô che khoang trước và cửa cốp mở về khoang hành lý sau hàng ghế thứ ba.',specs:[['Vai trò','Kết cấu & bảo vệ'],['Dài × rộng × cao','5.118 × 1.998 × 1.696 mm'],['Chiều dài cơ sở','3.150 mm']],source:specsPage},
{id:'glass',name:'Kính & cửa sổ trời',category:'Ngoại thất',tag:'TẦM NHÌN RỘNG MỞ',description:'Kính chắn gió, kính bên và tấm kính trần toàn cảnh mở khoang lái ra với không gian bên ngoài, tạo cảm giác rộng rãi cho cả ba hàng ghế.',principle:'Kính chắn gió và kính bên tạo tầm quan sát quanh xe. Cửa sổ trời toàn cảnh trên phiên bản cao cấp trải dài phần lớn trần xe; lớp kính tối màu trong mô hình chỉ là vật liệu dựng hình.',specs:[['Vai trò','Tầm nhìn & bao kín'],['Vị trí','Phần trên khoang lái']],source:specsPage},
{id:'doors',name:'Cửa xe & cửa cốp',category:'Ngoại thất',tag:'LỐI VÀO BA HÀNG GHẾ',description:'Bốn cửa bản lề truyền thống mở vào ba hàng ghế; cửa cốp phía sau mở lên cao để lấy hành lý. Tay nắm cửa ẩn phẳng với thân xe khi di chuyển.',principle:'Mỗi cửa là một cụm gồm tấm vỏ ngoài, kính, khóa, gioăng và ốp nội thất. Cửa cốp đóng mở điện, có thể điều khiển từ chìa khóa hoặc màn hình trung tâm.',specs:[['Kiểu mở','Bản lề truyền thống'],['Cửa cốp','Đóng mở điện'],['Tay nắm','Ẩn, tự bật']],source:manual},
{id:'cabin',name:'Khoang hành khách',category:'Nội thất',tag:'XÂY QUANH CON NGƯỚI',description:'Khoang hành khách nằm trên khối pin, gồm ba hàng ghế cho 6 hoặc 7 người, màn hình trung tâm 15,6 inch và hệ thống điều khiển hằng ngày của người lái.',principle:'Sàn phẳng của nền tảng xe điện cho phép nhiều cấu hình ghế: 7 chỗ với hàng giữa ba ghế, hoặc 6 chỗ với hai ghế thương gia. Mô hình nguồn không có nội thất chi tiết, nên phần này chỉ mang tính tham khảo.',specs:[['Số chỗ','6 hoặc 7'],['Màn hình trung tâm','15,6 inch'],['Vị trí','Phía trên khối pin']],source:specsPage},
{id:'battery',name:'Pin cao áp',category:'Năng lượng',tag:'NỀN TẢNG NĂNG LƯỢNG',description:'Khối pin lithium-ion làm mát bằng chất lỏng lưu trữ năng lượng cho toàn bộ xe. Đặt dưới sàn khoang lái, pin cấp điện cho hai động cơ điện.',principle:'Khi tăng tốc, điện năng chảy từ pin tới động cơ. Khi phanh tái sinh, động cơ đảo vai trò thành máy phát, chuyển động năng của xe trở lại thành điện nạp vào pin.',specs:[['Dung lượng','123 kWh'],['Tầm hoạt động','tới 580 km (công bố NEDC)'],['Hóa học','Lithium-ion, làm mát chất lỏng']],source:specsPage},
{id:'drive',name:'Động cơ điện',category:'Hệ truyền động',tag:'TỪ ĐIỆN THÀNH CHUYỂN ĐỘNG',description:'Hai động cơ điện biến năng lượng lưu trữ thành mô-men xoắn tại bánh xe. Một động cơ đặt ở cầu trước, một ở cầu sau, tạo hệ dẫn động bốn bánh toàn thời gian.',principle:'Bộ biến tần điều khiển từng động cơ; hộp giảm tốc một cấp truyền chuyển động quay tới bánh xe. Động cơ cũng giúp giảm tốc thông qua phanh tái sinh.',specs:[['Bố trí','Trước + sau, AWD'],['Công suất tối đa','300 kW (402 mã lực)'],['Mô-men xoắn','620 Nm'],['Hộp số','Một cấp']],source:specsPage},
{id:'suspension',name:'Hệ thống treo khí nén',category:'Khung gầm',tag:'KẾT NỐI VỚI MẶT ĐƯỚNG',description:'Bầu hơi khí nén nâng đỡ thân xe, giảm chấn điện tử kiểm soát dao động. Hệ thống có thể thay đổi độ cao gầm và cách xe phản ứng với mặt đường.',principle:'Treo trước tay đòn kép và treo sau đa liên kết dẫn hướng từng bánh. Áp suất khí quyết định độ cao, còn lực giảm chấn cân bằng giữa êm ái và ổn định. Cấu hình khí nén có trên phiên bản cao cấp.',specs:[['Lò xo','Khí nén (bản cao cấp)'],['Giảm chấn','Điện tử thích ứng'],['Độ cao gầm','Điều chỉnh được']],source:specsPage},
{id:'wheels',name:'Bánh xe & phanh',category:'Khung gầm',tag:'NƠI CHUYỂN ĐỘNG GẶP ĐỘ BÁM',description:'Lốp là điểm tiếp xúc duy nhất giữa xe và mặt đường. Sau mỗi mâm xe là đĩa phanh thông gió và cụm má phanh tạo lực ma sát.',principle:'Phanh tái sinh thu hồi năng lượng qua động cơ; phanh ma sát bổ sung lực dừng khi cần, với ABS giúp kiểm soát trượt bánh.',specs:[['Mâm xe','21 inch'],['Phanh','Đĩa thông gió, ABS'],['Thu hồi năng lượng','Phanh tái sinh']],source:specsPage},
];

/** Mô tả từng mảnh lưới theo nhãn do bước chuẩn bị mô hình gán. */
export function describePiece(label:string):string {
 const name=label.split(' · ')[0];
 const explanations:Record<string,string>={
  'Vỏ thân xe':'Mảng vỏ lớn liền khối của thân xe trong mô hình nguồn. Trên xe thật, phần này gồm nhiều tấm thép và nhôm được hàn, dán và bắt vít thành khung vỏ liền (body-in-white).',
  'Nắp ca-pô':'Nắp ca-pô đóng kín khoang phía trước. Mặt ngoài tiếp nối đường nét khí động của thân xe; bản lề và chốt khóa cho phép mở để tiếp cận khoang chứa đồ hoặc bộ phận kỹ thuật.',
  'Cản trước':'Ốp cản trước tạo hình phần mũi xe và bao quanh các khe hút gió phía dưới. Phần ốp nhìn thấy tách biệt với dầm hấp thụ va chạm ẩn phía sau.',
  'Cản sau':'Ốp cản sau hoàn thiện phần đuôi xe phía dưới. Đây là tấm vỏ ngoài, không phải dầm chịu va chạm bên trong.',
  'Cửa cốp':'Cửa cốp đóng kín khoang hành lý phía sau. Cụm đầy đủ gồm bản lề, ti chống điện và chốt khóa; trên VF 9 cửa cốp đóng mở bằng điện.',
  'Cửa trước':'Tấm vỏ cửa trước bản lề truyền thống. Cụm cửa hoàn chỉnh còn có kính, khóa, gioăng và ốp nội thất.',
  'Cửa sau':'Tấm vỏ cửa sau, mở vào hàng ghế thứ hai và thứ ba. Mô hình tách hình học chứ không mô phỏng chính xác quỹ đạo bản lề.',
  'Tai xe / hông xe':'Tấm ngoại thất ôm quanh hốc bánh xe, nối đường nét thân xe với cửa và cản liền kề.',
  'Nóc xe':'Tấm nóc nối các trụ và khép kín khoang lái phía trên. Trên phiên bản có cửa sổ trời toàn cảnh, phần lớn diện tích này là kính.',
  'Kính chắn gió & kính trần':'Trong mô hình nguồn, kính chắn gió và tấm kính trần toàn cảnh được dựng liền thành một mảng. Trên xe thật đây là hai tấm kính riêng, ngăn bởi khung trần phía trên hàng ghế trước.',
  'Kính trần':'Tấm kính trần toàn cảnh, mở tầm nhìn lên phía trên cho các hàng ghế. Có rèm che nắng điện bên dưới trên xe thật.',
  'Kính bên':'Kính cửa bên, hạ lên xuống theo cửa hoặc cố định ở hàng ghế thứ ba. Vị trí trước/sau ghi ở nhãn.',
  'Kính đèn trước':'Mặt kính che dải đèn LED phía trước, trải ngang đầu xe theo ngôn ngữ thiết kế chữ V của VinFast.',
  'Kính đèn sau':'Mặt kính che dải đèn hậu LED nối liền hai bên đuôi xe.',
  'Nắp tâm mâm':'Nắp che tâm mâm với logo hãng. Chi tiết trang trí che moay-ơ và bu-lông bánh.',
  'Chi tiết bánh xe':'Một chi tiết nhỏ trong cụm bánh xe của mô hình nguồn: có thể là nan mâm, ốp hốc bánh, bu-lông hoặc cảm biến.',
  'Khối che nội thất':'Mô hình nguồn không có nội thất; tác giả đặt một khối tối bên trong khoang lái để che khoảng trống khi nhìn qua kính. Nội thất thật của VF 9 gồm ba hàng ghế và màn hình trung tâm 15,6 inch.',
  'Lưới tản nhiệt / ốp đầu xe':'Tấm ốp đầu xe hoặc khe hút gió phía dưới. Xe điện không cần lưới tản nhiệt lớn nên phần lớn mặt trước được bịt kín để giảm lực cản.',
  'Thanh nóc':'Thanh nóc dọc theo mép trần, dùng để lắp giá chở đồ hoặc chỉ là chi tiết trang trí tùy phiên bản.',
  'Ốp bậc cửa':'Ốp bậc cửa hoặc tấm chắn phía dưới thân, che mép sàn và bảo vệ khỏi đá văng.',
  'Tay nắm cửa':'Tay nắm cửa. Trên VF 9 tay nắm ẩn phẳng với thân xe và tự bật ra khi mở khóa.',
  'Kính chắn gió':'Kính chắn gió cho tầm nhìn phía trước và là một phần kết cấu chịu lực của khoang lái. Màu tối trong mô hình là vật liệu dựng hình.',
  'Kính sau':'Kính sau nằm trên cửa cốp, cho tầm nhìn phía sau qua gương chiếu hậu trong xe.',
  'Kính bên / kính trần':'Một mảng kính bên hoặc kính trần. Tùy vị trí, nó cho tầm nhìn ngang hoặc mở tầm nhìn lên bầu trời.',
  'Kính':'Một mảng kính trong mô hình. Vị trí quyết định vai trò quan sát của nó; độ tối là do vật liệu dựng hình.',
  'Đèn trước':'Chi tiết thuộc cụm đèn trước. Cụm đầy đủ kết hợp thấu kính, nguồn sáng LED và chóa phản xạ để chiếu sáng đường và báo hiệu.',
  'Đèn sau':'Chi tiết thuộc cụm đèn sau, giúp báo hiệu sự hiện diện và ý định của xe. Mô hình tách hình dạng đèn nhưng không xác định chức năng điện của từng thấu kính.',
  'Logo VinFast':'Biểu tượng chữ V của VinFast trên đầu xe. Đây là chi tiết trang trí, không thuộc kết cấu hay hệ truyền động.',
  'Gương chiếu hậu':'Gương cho tầm nhìn bên hông và phía sau. Cụm hoàn chỉnh gồm mặt gương, vỏ và cơ cấu điều chỉnh điện.',
  'Ốp trang trí':'Chi tiết ốp hoàn thiện một mép hay điểm nhấn ngoại thất. Vị trí và hình dáng phản ánh cách người dựng mô hình thể hiện chiếc xe.',
  'Ốp gầm & chắn bùn':'Chi tiết thuộc phần hoàn thiện gầm xe hoặc lót hốc bánh. Chúng che vùng hở, hạn chế nước bắn, đá văng và điều hướng luồng khí.',
  'Lốp xe':'Lốp là bề mặt tiếp xúc giữa xe và mặt đường. Hợp chất cao su, gai lốp và áp suất quyết định độ bám, êm ái và lực cản lăn.',
  'Đĩa phanh':'Đĩa phanh quay cùng bánh xe. Má phanh kẹp vào đĩa để biến chuyển động thành nhiệt khi phanh ma sát, bổ trợ cho phanh tái sinh.',
  'Mâm xe':'Chi tiết thuộc mâm hợp kim. Mâm đỡ lốp và truyền tải trọng giữa lốp và moay-ơ; các nan nối vùng tâm với vành.',
  'Cụm bánh xe':'Một mảnh của cụm bánh xe trong mô hình nguồn, gồm lốp, mâm hoặc chi tiết phanh chưa được tách riêng.',
  'Nội thất':'Một mảnh của khoang hành khách trong mô hình. Mô hình nguồn tách ghế và ốp thành các đảo lưới, không gán mã phụ tùng nhà sản xuất.',
  'Chi tiết ngoại thất':'Một mảnh lưới ngoại thất riêng lẻ của mô hình nguồn. Danh tính phụ tùng chính xác chưa xác minh; hãy dựa vào vị trí và tổng quan hệ thống để hiểu ngữ cảnh.',
  'Chi tiết nhỏ':'Nhóm các mảnh lưới nhỏ cùng vật liệu được gộp lại để dễ quan sát. Chúng thường là bu-lông, khe, gờ hoặc chi tiết trang trí li ti.'
 };
 return explanations[name]||'Đây là một mảnh riêng của mô hình nguồn. Nhãn mô tả hình học nhìn thấy; mã phụ tùng chính hãng VinFast không được cung cấp.';
}
