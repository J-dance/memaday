import React from 'react'
import { useForm } from "react-hook-form"
import { UserLogin } from '../../../assets/types'
import styles from './LoginForm.module.scss'

const LoginForm = () => {
  // Initialize React-hook form
  const { register, handleSubmit, formState: { errors }} = useForm<UserLogin>();

  // Form submission handler
  const onSubmit = (data: UserLogin) => {
    console.log("data", data);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.field}>
        <label>Username</label>
        <input
          type="text"
          {...register("username", {
            // username validation
            required: {
              value: true,
              message: "Username required"
            }
          })} 
          placeholder="username"
        />
        {errors.username && (
          <div>{errors.username.message}</div>
        )}
      </div>

      <div className={styles.field}>
        <label>Password</label>
        <input
          type="password"
          {...register("password", {
            // password validation
            required: {
              value: true,
              message: "Password required"
            },
            minLength: {
              value: 8,
              message: "Minimum password length is 8 characters"
            },
            // must contain capital and lower case letter + number
            pattern: {
              value: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])/,
              message: "Invalid password"
            }
          })} 
          placeholder="password"
        />
        {errors.password && (
          <div className="error">{errors.password.message}</div>
        )}
      </div>
      <button type="submit">Log in</button>
    </form>
  )
}

export default LoginForm
