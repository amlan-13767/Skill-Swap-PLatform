import bcrypt from 'bcryptjs';
import './server/db';
import { storage } from './server/storage';

const username = 'demo_user_001';
const email = 'demo.user.001@skillswap.local';

try {
  const existing = await storage.getUserByEmail(email);
  console.log('existing', !!existing);
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await storage.createUser({
    username,
    passwordHash,
    name: 'Demo User',
    email,
    location: 'Bhubaneswar',
    avatar: null,
    skillsOffered: ['Python', 'SQL'],
    skillsWanted: ['React'],
    availability: ['weekdays'],
    isPublic: true,
  });
  console.log('created', user.id);
} catch (error: any) {
  console.error('ERROR_NAME', error?.name);
  console.error('ERROR_MESSAGE', error?.message);
  console.error('STACK', error?.stack);
  process.exitCode = 1;
}
