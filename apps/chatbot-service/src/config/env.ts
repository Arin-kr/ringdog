function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("CHATBOT_SERVICE_PORT", "4001")),

  jwtSecret: optional("JWT_SECRET", "dev-only-change-me"),

  bedrockModelId: optional("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"),
  bedrockMockMode: optional("BEDROCK_MOCK_MODE", "true") === "true",
  awsRegion: optional("AWS_REGION", "ap-northeast-2"),
};
