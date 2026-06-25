import { createApp } from './bootstrap';

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 4002);
}
bootstrap();
