
async function verify() {
    // Manually set env vars before importing db
    process.env.POSTGRES_URL = "postgres://postgres.nbwwmhltawpfifqafcrs:mcrBaSnD2YWrhlCn@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://postgres.nbwwmhltawpfifqafcrs:mcrBaSnD2YWrhlCn@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";

    console.log('Verifying lib/db connection...');
    // Dynamic import so it runs AFTER env vars are set
    const { sql } = await import('../lib/db');

    try {
        const result = await sql`SELECT version()`;
        console.log('✅ Connection successful!');
        console.log('Version:', result[0].version);
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

verify();
