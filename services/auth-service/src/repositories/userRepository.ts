import { Pool } from 'pg';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

export interface PublicUser {
  id: string;
  username: string;
}

export interface UserRepository {
  createUser(username: string, passwordHash: string): Promise<PublicUser>;
  findByUsername(username: string): Promise<UserRow | null>;
  findById(id: string): Promise<UserRow | null>;
  listExcept(id: string): Promise<PublicUser[]>;
}

/**
 * Postgres-backed implementation of UserRepository.
 * All queries are parameterized to avoid SQL injection.
 */
export function createUserRepository(pool: Pool): UserRepository {
  return {
    async createUser(username, passwordHash) {
      const result = await pool.query<PublicUser>(
        `INSERT INTO users (username, password_hash)
         VALUES ($1, $2)
         RETURNING id, username`,
        [username, passwordHash]
      );
      return result.rows[0];
    },

    async findByUsername(username) {
      const result = await pool.query<UserRow>(
        `SELECT id, username, password_hash, created_at
         FROM users
         WHERE username = $1`,
        [username]
      );
      return result.rows[0] ?? null;
    },

    async findById(id) {
      const result = await pool.query<UserRow>(
        `SELECT id, username, password_hash, created_at
         FROM users
         WHERE id = $1`,
        [id]
      );
      return result.rows[0] ?? null;
    },

    async listExcept(id) {
      const result = await pool.query<PublicUser>(
        `SELECT id, username
         FROM users
         WHERE id <> $1
         ORDER BY username ASC`,
        [id]
      );
      return result.rows;
    },
  };
}
