// Username cố định của MqttRealtimeGamePublisherAdapter (GameModule) khi tự connect vào broker
// — KHÔNG phải end-user, không có access token thật. Đặt ở đây (không phải trong
// aedes-mqtt-broker.adapter.ts) vì giờ có 3 nơi cần khớp đúng 1 chuỗi này: adapter tự connect
// (GameModule), AedesMqttBrokerAdapter (giai đoạn 1, nhận diện lúc CONNECT), và
// MqttAuthorizeController (giai đoạn 2, nhận diện lúc AUTHORIZE — EMQX áp webhook cho cả
// publish lẫn subscribe, nên internal-publisher cũng đi qua đây, xem PLAN-REALTIME.md mục 5).
export const INTERNAL_PUBLISHER_USERNAME = 'internal-publisher';

// Quy ước đặt tên topic MQTT dùng chung giữa RealtimeModule (broker, kiểm quyền SUBSCRIBE) và
// Infrastructure layer của các module publish state (hiện chỉ có GameModule) — xem
// PLAN-REALTIME.md mục 4. Chỉ 1 chỗ biết chuỗi "ww/room/" để đổi tiền tố sau này không phải sửa
// nhiều nơi.
const ROOM_TOPIC_PREFIX = 'ww/room/';

export function roomStateTopic(roomId: number): string {
  return `${ROOM_TOPIC_PREFIX}${roomId}/state`;
}

export function roomLynchVotesTopic(roomId: number): string {
  return `${ROOM_TOPIC_PREFIX}${roomId}/lynch-votes`;
}

export function roomWolfVotesPingTopic(roomId: number): string {
  return `${ROOM_TOPIC_PREFIX}${roomId}/wolf-votes-ping`;
}

// "ww/room/42/state" → 42. Dùng ở bước SUBSCRIBE (PLAN-REALTIME.md mục 5) để biết client đang
// xin quyền xem phòng nào — null nếu topic không khớp mẫu ww/room/{id}/... (client tự subscribe
// bậy, hoặc topic hệ thống như $SYS/#) — deny-by-default cho mọi topic không khớp.
export function parseRoomIdFromTopic(topic: string): number | null {
  const match = /^ww\/room\/(\d+)\//.exec(topic);
  if (!match) return null;
  return Number(match[1]);
}
