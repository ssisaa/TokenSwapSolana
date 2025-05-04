/**
 * Authentication types used throughout the application
 */

// Type for admin users as received from the API
export interface AdminUser {
  id: number;
  username: string;
  isFounder: boolean;
  founderPublicKey?: string;
  createdAt: string;
  lastLogin?: string;
}

// Login data payload
export interface LoginData {
  username: string;
  password: string;
}

// Registration data payload (extends login data)
export interface RegisterData extends LoginData {
  isFounder?: boolean;
  founderPublicKey?: string;
}