export interface UserProfile {
  email: string;
  role: 'ADMINISTRADOR' | 'USUARIO' | string;
  isAdmin: boolean;
}

export type CurrentUserProfile = UserProfile;
