export interface User {
  name: string;
  surname: string;
  email: string;
}

export interface SignupRequest extends User {
  password: string;
}

export type UpdateProfileRequest = User;

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}
