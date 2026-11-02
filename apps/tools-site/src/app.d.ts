declare global {
  namespace App {
    interface Error {
      /** Correlation id of an unexpected server error, matching its server log entry. */
      errorId?: string;
    }
    interface Locals {}
    interface PageData {}
    interface Platform {}
  }
}

export {};
