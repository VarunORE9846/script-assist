import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../../modules/users/entities/user.entity';
import { Task } from '../../modules/tasks/entities/task.entity';
import { RefreshToken } from '../../modules/auth/entities/refresh-token.entity';
import { users } from './seed-data/users.seed';
import { tasks } from './seed-data/tasks.seed';

// Load environment variables
config();

console.log('🌱 Starting database seeding...');
console.log('Database config:', {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  database: process.env.DB_DATABASE || 'taskflow',
});

// Define the data source
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'taskflow',
  entities: [User, Task, RefreshToken],
  synchronize: false,
  logging: true,
});

// Initialize and seed database
async function main() {
  try {
    console.log('📡 Initializing database connection...');
    // Initialize connection
    await AppDataSource.initialize();
    console.log('✅ Database connection initialized');

    console.log('🗑️  Clearing existing data...');
    // Clear existing data
    await AppDataSource.getRepository(Task).delete({});
    await AppDataSource.getRepository(User).delete({});
    console.log('✅ Existing data cleared');

    console.log('👥 Seeding users...');
    // Seed users
    const savedUsers = await AppDataSource.getRepository(User).save(users);
    console.log(`✅ ${savedUsers.length} users seeded successfully`);
    savedUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role})`);
    });

    console.log('📋 Seeding tasks...');
    // Seed tasks
    const savedTasks = await AppDataSource.getRepository(Task).save(tasks);
    console.log(`✅ ${savedTasks.length} tasks seeded successfully`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 You can now login with:');
    console.log('   Admin: admin@example.com / admin123');
    console.log('   User:  user@example.com / user123');
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close connection
    await AppDataSource.destroy();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seeding
console.log('🚀 Running seed script...\n');
main(); 