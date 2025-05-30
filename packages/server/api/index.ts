import type { Handler } from "express";

export const get: Handler = (_req, res) => {
  res.send("hi, how are you?");
};
