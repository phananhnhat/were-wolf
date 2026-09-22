import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

// Hợp đồng chung cho "thứ khởi động/dừng broker MQTT lúc app boot/tắt". KHÔNG đặt trong
// application/ports/ như các port khác — đây không phải thứ Domain/Application cần (không ai
// @Inject cái này), mà là hợp đồng NỘI BỘ giữa các adapter Infrastructure (AedesMqttBrokerAdapter
// / EmqxMqttBrokerAdapter) để đổi broker chỉ cần đổi provider ở realtime.module.ts, không đổi gì
// ở GameModule hay use case nào — xem PLAN-REALTIME.md mục 3.
export interface MqttBroker extends OnModuleInit, OnModuleDestroy {}
