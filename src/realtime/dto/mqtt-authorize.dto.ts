import { IsIn, IsString } from 'class-validator';

// Body EMQX gửi lên khi gọi webhook `authorization` type http — xem emqx/emqx.conf. Không phải
// request của end-user (không đi qua JwtAuthGuard) nên không có gì bí mật trong DTO này ngoài
// đúng 3 field cần để trả lời "userId có được làm hành động này trên topic này không".
//
// `userId: string`, không phải `number` — EMQX chỉ template placeholder (`${username}`) thành
// chuỗi trong JSON body dù giá trị "trông giống số". Cố ý KHÔNG dùng `@IsNumberString()`: EMQX
// áp webhook này cho CẢ publish lẫn subscribe, và MqttRealtimeGamePublisherAdapter (backend tự
// publish) connect với username = "internal-publisher" — chuỗi không phải số — nên
// MqttAuthorizeController cần nhận được giá trị đó nguyên vẹn để tự nhận diện, không bị
// validation chặn trước khi vào tới đó.
export class MqttAuthorizeDto {
  @IsString()
  userId: string;

  @IsString()
  topic: string;

  // EMQX gửi đúng 1 trong 2 giá trị này (${action} — publish|subscribe). Cần để phân biệt: ai
  // cũng subscribe được nếu là thành viên phòng, nhưng CHỈ internal-publisher được publish —
  // đúng ranh giới authorizeSubscribe/authorizePublish tách riêng của AedesMqttBrokerAdapter.
  @IsIn(['publish', 'subscribe'])
  action: 'publish' | 'subscribe';
}
