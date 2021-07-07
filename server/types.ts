// Schema for users data obtained from sign up.
export interface UserSchema {
  userID: number
  firstName: string,
  lastName: string,
  email: string,
  username: string,
  password: string
  isAdmin: boolean
}

// Schema for user log in request
export interface UserLogin {
  username: string,
  password: string
}

export interface UserLoginHash extends UserLogin {
  hash: string
}

export interface ErrorMessage {
  value: boolean,
  message: string
}

// Log in api response error message data
export interface LoginErrors {
  username: ErrorMessage,
  password: ErrorMessage
}