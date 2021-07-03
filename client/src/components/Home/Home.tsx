import React from 'react'
import styles from './Home.module.scss'
import logo from '../../assets/SVGs/logo.svg'

const Home = () => {
  return (
    <section className={styles.homePage}>
      <div className={styles.homePageBackground}>
        <div className={styles.leftUpperCorner}></div>
        <div className={styles.rightUpperCorner}></div>
        <div className={styles.leftLowerCorner}></div>
        <div className={styles.rightLowerCorner}></div>
        <div className={styles.titleContainer}>
          <div className={styles.titleAntiContainer}>
              <img src={logo} />
              <div>
                <h1 className={styles.title}>memAday</h1>
                <p className={styles.slogan}>Get the joy of forgotten memories!</p>
              </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Home
