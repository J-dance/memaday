import React from 'react'
import styles from './Login.module.scss'
import logo from '../../assets/SVGs/logo.svg'
import LoginForm from './LoginForm/LoginForm'

const Login = () => {
  return (
    <section className={styles.loginPage}>
      <div className={styles.leftSide}>
        <div className={`${styles.frame} ${styles.titleContainer}`}>
          <div className={styles.titleGrid}>
            <h1 className={`${styles.title} ${styles.mem}`}>mem</h1>
            <h1 className={`${styles.title} ${styles.a}`}>A</h1>
            <h1 className={`${styles.title} ${styles.day}`}>day</h1>
            </div>
        </div>
      </div>
      <div className={styles.rightSide}>
        <img src={logo} />
        <LoginForm />
      </div>
    </section>
  )
}

export default Login
