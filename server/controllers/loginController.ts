import bcrypt from 'bcryptjs'
import { UserLogin, LoginErrors } from '../types'
import { loginData } from '../models/loginModel'

// Function to check user log in data against database
export const loginCheck = (data: UserLogin): LoginErrors => {
  // get users database data from model
  const userDataDb: UserLogin = loginData();

  // initiate empty error response for client
  const responseMessages: LoginErrors = {
    status: 200,
    username: {
      value: false,
      message: ''
    },
    password: {
      value: false,
      message: ''
    }
  };

  // Check if username exist
  if (userDataDb.username == data.username) {
    // check is password matched hashed password from model
    const result: boolean = bcrypt.compareSync(data.password, userDataDb.password);
    if (result) {
      // password correct
      // set good error code
      responseMessages.status = 200;
    }
    else {
      // incorrect password set bad error code
      responseMessages.status = 401;
      responseMessages.password.value = true;
      responseMessages.password.message = 'Incorrect password';
    }
  }
  else {
    // incorrect username set bad error code
    responseMessages.status = 404;
    responseMessages.username.value = true;
    responseMessages.username.message = 'Could not find the username entered';
  }

  return responseMessages
}
