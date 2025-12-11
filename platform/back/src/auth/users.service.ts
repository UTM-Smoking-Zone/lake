import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private databaseService: DatabaseService) {}

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.databaseService.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || undefined;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return undefined;
    }
  }

  async findById(id: string): Promise<User | undefined> {
    try {
      const result = await this.databaseService.query(
        'SELECT * FROM users WHERE id = $1',
        [parseInt(id)]
      );
      return result.rows[0] || undefined;
    } catch (error) {
      console.error('Error finding user by id:', error);
      return undefined;
    }
  }

  async create(email: string, password: string, displayName?: string): Promise<User> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      const result = await this.databaseService.query(
        `INSERT INTO users (email, password_hash, display_name, is_active, created_at) 
         VALUES ($1, $2, $3, $4, NOW()) 
         RETURNING id, email, display_name, is_active, created_at`,
        [email, hashedPassword, displayName, true]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw new ConflictException('Failed to create user');
    }
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, user.password_hash);
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  }

  async updateLastLogin(userId: number): Promise<void> {
    try {
      await this.databaseService.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }
}
