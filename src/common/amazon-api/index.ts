import { HTTPException } from "hono/http-exception";

export interface AmazonApiProps {
  amazonBase: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export const amazonApi = async <T>(props: AmazonApiProps) => {
  const { amazonBase, method, path, body, headers = {}, query } = props;

  const url = new URL(path, amazonBase);

  if (query) {
    Object.keys(query).forEach((key) =>
      url.searchParams.append(key, query[key])
    );
  }

  let response;
  let result;
  
  while (true) { // Infinite loop until 200 status code is returned
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": getRandomUserAgent(), // Randomized User-Agent
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const { status, ok } = response;
      result = tryParseJson(await response.text());

      if (ok) { // If 200 OK is returned
        return result as T;
      }

      // If response is not OK (i.e., status is not 200), continue retrying
      console.log(`Received status code ${status}, retrying...`);

    } catch (error) {
      console.error("Error during request, retrying...", error);
    }
  }
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
