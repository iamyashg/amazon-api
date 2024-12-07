import { HTTPException } from "hono/http-exception";

export interface AmazonApiProps {
  amazonBase: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

const MAX_RETRIES = 5; // Maximum retries for 503 errors

export const amazonApi = async <T>(props: AmazonApiProps) => {
  const { amazonBase, method, path, body, headers = {}, query } = props;

  const url = new URL(path, amazonBase);

  if (query) {
    Object.keys(query).forEach((key) =>
      url.searchParams.append(key, query[key])
    );
  }

  // Retry mechanism
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": getRandomUserAgent(), // Randomize User-Agent on each request
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const { status, ok } = response;
      const result = tryParseJson(await response.text());

      if (!ok) {
        throw new HTTPException(status as any, {
          message: `API Error Occurred with status code ${status}`,
        });
      }

      return result as T;
    } catch (error) {
      if (error instanceof HTTPException && error.status === 503) {
        attempt++;
        lastError = error;
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retry
      } else {
        throw error; // Rethrow any other errors immediately
      }
    }
  }

  throw new Error(`Max retries reached. Last error: ${lastError?.message}`);
};

// Randomized User-Agent to avoid detection
const getRandomUserAgent = (): string => {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36"
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text) as any;
  } catch {
    try {
      const splitted = text.split("\n&&&\n");
      if (splitted.length < 3) throw new Error();

      return splitted
        .map((s) => {
          try {
            return JSON.parse(s);
          } catch {
            return null;
          }
        })
        .filter((s) => s) as any[];
    } catch {
      return text as string;
    }
  }
};
