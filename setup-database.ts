import postgres from "postgres";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function setupDatabase() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL!;
  console.log('🐘 Connecting to:', connectionString ? connectionString.split('@')[1] : 'MISSING URL');
  const sql = postgres(connectionString, {
    prepare: false,
    ssl: 'require',
  });
  
  try {
    console.log('Setting up ERP database...');
    
    // Create roles table
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Roles table created successfully!');
    
    // Insert default roles
    await sql`
      INSERT INTO roles (role_name, description) VALUES
        ('Admin', 'Administrator with full access'),
        ('Manager', 'Manager with team management access'),
        ('Employee', 'Regular employee with limited access')
      ON CONFLICT (role_name) DO NOTHING
    `;
    
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role_id INTEGER REFERENCES roles(id),
        image_url VARCHAR(500),
        phone VARCHAR(20),
        address TEXT,
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Users table created successfully!');

    // Ensure schema upgrades on existing databases
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    
    // Create chat messages table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text', -- text | image | file | audio
        attachment_url VARCHAR(500),
        attachment_type VARCHAR(100),
        duration_ms INTEGER,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        is_group BOOLEAN DEFAULT false,
        group_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Chat messages table created successfully!');

    // Ensure schema upgrades on existing databases for chat_messages
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text'`;
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500)`;
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100)`;
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS duration_ms INTEGER`;
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`;
    
    // Create todos table
    await sql`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) DEFAULT 'medium', -- high, medium, low
        status VARCHAR(50) DEFAULT 'pending', -- pending, in-progress, on-hold, done
        category VARCHAR(50) DEFAULT 'inbox', -- inbox, important, trash
        is_important BOOLEAN DEFAULT false,
        assigned_to VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Todos table created successfully!');
    
    // Create delegations table with all form fields
    await sql`
      CREATE TABLE IF NOT EXISTS delegations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delegation_name VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to VARCHAR(255) NOT NULL,
        doer_name VARCHAR(255),
        department VARCHAR(255),
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        due_date TIMESTAMP,
        voice_note_url TEXT,
        reference_docs JSONB,
        evidence_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Delegations table created successfully!');
    
    // Create indexes for delegations
    await sql`CREATE INDEX IF NOT EXISTS idx_delegations_user_id ON delegations(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_delegations_due_date ON delegations(due_date)`;
    
    // Check if users table is empty
    const existingUsers = await sql`SELECT COUNT(*) FROM users`;
    const userCount = parseInt(existingUsers[0].count);
    
    if (userCount === 0) {
      console.log('Inserting sample users...');
      
      // Get role IDs
      const roles = await sql`SELECT id, role_name FROM roles`;
      const adminRole = roles.find((r: any) => r.role_name === 'Admin') || { id: 1 };
      const managerRole = roles.find((r: any) => r.role_name === 'Manager') || { id: 2 };
      
      // Hash passwords
      const hashedPassword1 = await bcrypt.hash('admin123', 10);
      const hashedPassword2 = await bcrypt.hash('user123', 10);
      
      // Insert sample users
      await sql`
        INSERT INTO users (username, email, password, role_id, full_name, phone, address) VALUES 
          ('admin', 'admin@erp.com', ${hashedPassword1}, ${adminRole.id}, 'Admin User', '9876543210', '123 Admin Street'),
          ('john_doe', 'john@erp.com', ${hashedPassword2}, ${managerRole.id}, 'John Doe', '9876543211', '456 Manager Ave')
      `;
      
      console.log('✓ Sample users inserted successfully!');
      
      // Insert sample delegations
      const users = await sql`SELECT id FROM users`;
      if (users.length > 0) {
        const adminId = users[0].id;
        await sql`
          INSERT INTO delegations (
            user_id, 
            delegation_name, 
            description, 
            assigned_to, 
            doer_name,
            department,
            priority,
            status, 
            due_date,
            evidence_required
          ) VALUES
            (
              ${adminId}, 
              'Setup Company Profile', 
              'Complete company information and branding', 
              'John Doe',
              'Jane Smith',
              'IT',
              'high',
              'pending', 
              ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()},
              true
            ),
            (
              ${adminId}, 
              'Create User Accounts', 
              'Create accounts for all team members', 
              'Jane Smith',
              'Mike Johnson',
              'Human Resources',
              'medium',
              'pending', 
              ${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()},
              false
            ),
            (
              ${adminId}, 
              'Setup Modules', 
              'Configure all ERP modules', 
              'Mark Wilson',
              'Sarah Davis',
              'Operations',
              'high',
              'pending', 
              ${new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()},
              true
            )
        `;
        console.log('✓ Sample delegations inserted!');
      }
    } else {
      console.log(`✓ Users table already has ${userCount} users`);
    }
    
    // Verify
    const users = await sql`SELECT id, username, email FROM users`;
    console.log(`\n✓ Database setup complete! Found ${users.length} users:\n`);
    users.forEach((user: any, i: number) => {
      console.log(`${i + 1}. ${user.username} (${user.email})`);
    });
    
    console.log('\n📝 Test credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: Admin');
    console.log('\n   Or:');
    console.log('   Username: john_doe');
    console.log('   Password: user123');
    console.log('   Role: Manager');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase();
