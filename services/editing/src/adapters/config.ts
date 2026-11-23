// The configuration of Editing, read from environment variables, so the same image runs in Compose, on Kubernetes and in the CI.
export type Config = {
  port: number;
  logLevel: string;
  databaseUrl: string;
  kafkaBrokers: string[];
};

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
  };
  return {
    // An empty variable counts as unset, as Compose leaves it when it substitutes one that is not set
    port: Number(env.PORT || 8080),
    logLevel: env.LOG_LEVEL || 'info',
    databaseUrl: required('DATABASE_URL'),
    kafkaBrokers: required('KAFKA_BROKERS').split(','),
  };
}
