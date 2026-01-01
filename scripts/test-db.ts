import postgres from 'postgres';

// Hardcoded credentials for testing
const CREDS = {
    POSTGRES_URL: "postgres://postgres.nbwwmhltawpfifqafcrs:mcrBaSnD2YWrhlCn@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
    POSTGRES_URL_NON_POOLING: "postgres://postgres.nbwwmhltawpfifqafcrs:mcrBaSnD2YWrhlCn@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require",
    POSTGRES_PRISMA_URL: "postgres://postgres.nbwwmhltawpfifqafcrs:mcrBaSnD2YWrhlCn@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
};

// Helper to test a connection
async function testConnection(name: string, url: string | undefined, options: any = {}) {
    if (!url) {
        console.log(`❌ ${name}: URL not provided`);
        return;
    }

    console.log(`\nTesting ${name}...`);
    // console.log(`URL: ${url}`); 
    console.log(`Options:`, options);

    try {
        const sql = postgres(url, {
            connect_timeout: 10,
            ...options
        });

        const version = await sql`SELECT version()`;
        console.log(`✅ ${name}: Connected successfully!`);
        console.log(`   Version: ${version[0].version}`);

        try {
            // Just verify we can run a simple query
            const result = await sql`SELECT 1 as result`;
            console.log(`   Simple query result: ${result[0].result}`);
        } catch (e: any) {
            console.log(`   ⚠️ Simple query failed: ${e.message}`);
        }

        await sql.end();
    } catch (error: any) {
        console.error(`❌ ${name}: Connection failed`);
        console.error(`   Error: ${error.message}`);
    }
}

async function run() {
    console.log('--- Starting Database Connection Tests (Hardcoded) ---');

    // 1. Test standard POSTGRES_URL (Transaction Pooler)
    await testConnection('Standard POSTGRES_URL', CREDS.POSTGRES_URL);

    // 2. Test POSTGRES_URL with prepare: false (Important for Transaction Mode)
    await testConnection('POSTGRES_URL (prepare: false)', CREDS.POSTGRES_URL, { prepare: false });

    // 3. Test Direct Connection (POSTGRES_URL_NON_POOLING)
    await testConnection('Direct Connection (NON_POOLING)', CREDS.POSTGRES_URL_NON_POOLING);

    console.log('\n--- Tests Completed ---');
    process.exit(0);
}

run();
