import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";

const brokers = (Bun.env.KAFKA_BROKERS ?? "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);
const topic = Bun.env.KAFKA_TOPIC ?? "elysia-events";
const groupId = Bun.env.KAFKA_GROUP_ID ?? "elysia-example";

if (brokers.length === 0) {
  throw new Error("KAFKA_BROKERS must contain at least one host:port value");
}

const kafka = new Kafka({
  clientId: Bun.env.KAFKA_CLIENT_ID ?? "elysia-kafka-example",
  brokers,
  logLevel: logLevel.ERROR,
  ...(Bun.env.KAFKA_USERNAME && Bun.env.KAFKA_PASSWORD
    ? {
        sasl: {
          mechanism: "plain" as const,
          username: Bun.env.KAFKA_USERNAME,
          password: Bun.env.KAFKA_PASSWORD,
        },
        ssl: Bun.env.KAFKA_SSL !== "false",
      }
    : {}),
});

export type KafkaEvent = {
  type: string;
  payload: unknown;
  createdAt: string;
};

export function createProducer(): Producer {
  return kafka.producer();
}

export async function publishEvent(
  producer: Producer,
  event: KafkaEvent,
): Promise<void> {
  await producer.send({
    topic,
    messages: [{
      key: event.type,
      value: JSON.stringify(event),
      headers: { "content-type": "application/json" },
    }],
  });
}

export async function consumeEvents(
  onEvent: (event: KafkaEvent) => Promise<void> | void,
): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: KafkaEvent;
      try {
        event = JSON.parse(message.value.toString()) as KafkaEvent;
        if (typeof event.type !== "string" || typeof event.createdAt !== "string") {
          throw new Error("event must include string type and createdAt fields");
        }
      } catch (error) {
        console.error("Kafka message ignored: invalid event payload", error);
        return;
      }

      await onEvent(event);
    },
  });
  return consumer;
}

let sharedProducer: Producer | undefined;
let sharedProducerConnected = false;

export async function publishOrderCreated(payload: unknown): Promise<void> {
  if (Bun.env.KAFKA_ENABLED !== "true") return;
  sharedProducer ??= createProducer();
  if (!sharedProducerConnected) {
    await sharedProducer.connect();
    sharedProducerConnected = true;
  }
  await publishEvent(sharedProducer, {
    type: "order.created",
    payload,
    createdAt: new Date().toISOString(),
  });
}
