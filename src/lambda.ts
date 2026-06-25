import express = require('express');
import { createApp } from './bootstrap';

const serverlessExpress = require('@codegenie/serverless-express') as (
  options: { app: ReturnType<typeof express> },
) => (
  event: Record<string, unknown>,
  context: Record<string, unknown>,
  callback?: (...args: unknown[]) => void,
) => Promise<unknown>;

let cachedHandler:
  | ((
      event: Record<string, unknown>,
      context: Record<string, unknown>,
      callback?: (...args: unknown[]) => void,
    ) => Promise<unknown>)
  | undefined;

async function getHandler() {
  if (!cachedHandler) {
    const expressApp = express();
    await createApp(expressApp);
    cachedHandler = serverlessExpress({ app: expressApp });
  }

  return cachedHandler;
}

export const handler = async (
  event: Record<string, unknown>,
  context: Record<string, unknown>,
  callback?: (...args: unknown[]) => void,
) => {
  const server = await getHandler();
  return server(event, context, callback);
};
