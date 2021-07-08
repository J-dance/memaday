import { UserLogin } from '../types'
import bcrypt from 'bcryptjs'


export const loginData = (): UserLogin => {
  console.log('login model running..')

  // dummy data ** Replace
  const exampleData: UserLogin = {
    username: 'test',
    password: 'Test1234'
  }

  // salt is the random text added
  const salt = bcrypt.genSaltSync(10);
  // hash password
  const hash = bcrypt.hashSync(exampleData.password, salt);
  
  return {
    username: exampleData.username,
    password: hash
  }
}



