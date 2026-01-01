import postgres from "postgres";

// Initialize the PostgreSQL database connection
// Use POSTGRES_URL for Vercel (pooled connection) or fallback to DATABASE_URL for local dev
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL!;
console.log('🐘 DB connecting to:', connectionString ? connectionString.split('@')[1] : 'MISSING URL');

const sql = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close connections after 20 seconds of inactivity
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Required for Supabase Transaction Mode (port 6543)
  ssl: 'require',
});

// Helper function to execute queries with retry logic
export async function executeQuery<T = any>(
  queryFn: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;
      console.error(`Query attempt ${attempt + 1} failed:`, error.message);

      // Don't retry on validation errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Wait before retrying, with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

export async function getData() {
  return executeQuery(async () => {
    const data = await sql`SELECT * FROM posts;`;
    return data;
  });
}

export { sql };
