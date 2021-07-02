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
      <div className={styles.formTitleContainer}>
        <p className={styles.textTitle}>Log in or sign up <span className={styles.link}>here</span></p>
      </div>
      <div className={styles.field}>
        <label className={styles.labelText}>Username</label>
        <input
          className={styles.inputBox}
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
        <label className={`${styles.labelText}`}>Password</label>
        <p className={styles.password}>Must contain a number and upper case letter</p>
        <input
        className={styles.inputBox}
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
      <button className={styles.button} type="submit">Log in</button>
      <div className={styles.formTitleContainer}>
        <p className={styles.slogan}>Get the joy of forgotten memories!</p>
      </div>
    </form>
  )
}

export default LoginForm
