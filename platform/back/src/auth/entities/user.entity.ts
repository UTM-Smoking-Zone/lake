export class User {
  id: number;
  email: string;
  password_hash: string;
  display_name?: string;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
}
